//This is the main map component. It is responsible for rendering the map and handling all the drill down and drill up functionality.

// React Imports
import React, { useState, useContext, useEffect } from "react";

// Context Imports
import DataContext from "../contexts/Data.Context.js";

// React Leaflet Imports
import { MapContainer, TileLayer } from "react-leaflet";
import { GeoJSON, Marker, FeatureGroup } from "react-leaflet";

// leaflet imports
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { divIcon } from "leaflet";

// Custom Component Imports
import ZoomtoBounds from "./ZoomToBounds";
import CustomSensorMarkers from "./CustomSensorMarkers";

// api imports
import fetchAQData from "../utils/fetchAQData.js";
import getGeoDataV2 from "../utils/fetchGeoDataV2.js";
import fetchSensorGeoData from "../utils/fetchSensorGeoData.js";
import fetchSensorAQData from "../utils/fetchSensorAQData.js";

// style imports
import "../styles/Map.css";

// utils imports
import {
  indiaGeoJSONStyleV1,
  divisionGeoJSONStyleV1,
  districtGeoJSONStyleV1,
} from "../utils/geojsonStyles.js";
import roundOffFull from "../utils/roundOffFull.js";

// layer names as defined in geoserver
const stateDataLayerName = "geonode:India_States_Simplified_V2";
const divisionDataLayerName = "geonode:India_Divisions_Merged_V1";
const districtDataLayerName = "geonode:India_Districts_Merged_Simplified_V1";

// global variables
const mapCenter = [23.5937, 80.9629];

// Main Map component
function LeafletMap() {
  // get data from context
  // get start date and end date
  const { startDate } = useContext(DataContext);
  const { endDate } = useContext(DataContext);

  // get sampling period and sampling value
  const { samplingPeriod } = useContext(DataContext);
  const { samplingValue } = useContext(DataContext);

  // get AQ Data Query Params
  const { AQDataQueryParams, setAQDataQueryParams } = useContext(DataContext);

  // geo data names
  const { selectedState, setSelectedState } = useContext(DataContext);
  const { selectedDivision, setSelectedDivision } = useContext(DataContext);
  const { selectedDistrict, setSelectedDistrict } = useContext(DataContext);

  // geo data
  const { statesData, setStatesData } = useContext(DataContext);
  const { filteredDivisionsGeojson, setFilteredDivisionGeojson } =
    useContext(DataContext);
  const { filteredDistrictsGeojson, setFilteredDistrictsGeojson } =
    useContext(DataContext);

  // sensor data
  const { statesSensorData, setStatesSensorData } = useContext(DataContext);
  const { divisionsSensorData, setDivisionsSensorData } =
    useContext(DataContext);
  const { districtsSensorData, setDistrictsSensorData } =
    useContext(DataContext);

  // selected feature and feature name
  const { setSelectedFeature } = useContext(DataContext);
  const { setSelectedFeatureName } = useContext(DataContext);

  // selected pollutant
  const { selectedPollutant } = useContext(DataContext);

  // layer number
  // variable to track drill up and drill down;
  // State: 1
  // Division: 2
  // District: 3
  // Sensor: 4
  const { layerNo, setLayerNo } = useContext(DataContext);

  // loading state
  const { isLoading, setIsLoading } = useContext(DataContext);

  // set initial currentLayer to "India" (State Level)
  const { currentLayer, setCurrentLayer } = useContext(DataContext);

  // set initial bounds of map
  const { bounds, setBounds } = useContext(DataContext);

  // some useState variables
  const { setHasDrilledDown } = useContext(DataContext);

  // show or hide sensor layer
  const { showSensorLayer, setShowSensorLayer } = useContext(DataContext);

  // global variables in this component
  var featureBounds;

  // function to handle single click on polygon feature
  // this updates the card component header
  function onFeatureClick(e) {
    var featureName;
    var selectedFeature = e.target.feature;

    // Level 1: State Level
    if (layerNo === 1) {
      featureName = e.target.feature.properties.state;
    }
    // Level 2: Division Level
    else if (layerNo === 2) {
      featureName = e.target.feature.properties.division;
    }
    // Level 3: District Level
    else if (layerNo === 3) {
      featureName = e.target.feature.properties.district;
    }
    // Update card component header
    setSelectedFeatureName(featureName);
    setSelectedFeature(selectedFeature);
  }

  // function to handle click on sensor feature
  function onSensorClick(feature) {
    var featureName = feature.properties.imei_id;

    // Update Card component header
    setSelectedFeatureName(featureName);
    setSelectedFeature(feature);
  }

  //===============================================================
  //===============================================================
  //
  // MAIN CODE - DRILL DOWN
  //
  //===============================================================
  //===============================================================

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////  INITIAL MAP LOAD  ////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // function to fetch data for initial map load
  const fetchData = async (
    setIsLoading,
    setStatesData,
    setStatesSensorData,
    startDate,
    endDate,
    samplingPeriod,
    samplingValue
  ) => {
    // Set loading state
    setIsLoading(true);

    // this will be used for AQ Data of polygons as well as sensors
    const AQDataQueryParams = buildStateAQDataQueryParams(
      startDate,
      endDate,
      samplingPeriod,
      samplingValue
    );

    // this will be used for AQ Data of polygons as well as sensors
    const fallbackAQDataQueryParams = buildStateAQDataQueryParams(null);

    const sensorGeoDataQueryParams = buildStateSensorGeoDataQueryParams();

    const AQData = await fetchAQData(
      AQDataQueryParams,
      fallbackAQDataQueryParams
    );
    const sensorGeoData = await fetchSensorGeoData(sensorGeoDataQueryParams);
    console.log("Sensor Geo Data: ", sensorGeoData);

    const sensorAQData = await fetchSensorAQData(
      AQDataQueryParams,
      fallbackAQDataQueryParams
    );
    console.log("Sensor AQ Data: ", sensorAQData);
    const sensorGeoJSON = createSensorGeoJSON(sensorGeoData);
    const mergedSensorData = mergeSensorAQandGeoData(
      sensorAQData,
      sensorGeoJSON
    );
    console.log("Merged Sensor Data: ", mergedSensorData);
    const geoData = await fetchStateGeoData();
    const mergedData = mergeAQAndGeoData(AQData, geoData, "state");
    setStatesData(mergedData);
    setStatesSensorData(mergedSensorData);
    setIsLoading(false);
  };

  const buildStateAQDataQueryParams = (
    startDate,
    endDate,
    samplingPeriod,
    samplingValue
  ) => {
    let AQDataQueryParams = {
      admin_level: "state",
      params: "pm2.5cnc,pm10cnc,temp,humidity,so2ppb,no2ppb,o3ppb,co",
    };

    if (startDate && endDate && samplingPeriod && samplingValue) {
      AQDataQueryParams = {
        ...AQDataQueryParams,
        from_date: startDate,
        to_date: endDate,
        sampling: samplingPeriod || "hours",
        sampling_value: samplingValue || 1,
      };
    }

    return AQDataQueryParams;
  };

  const buildStateSensorGeoDataQueryParams = () => {
    return {
      admin_level: "state",
    };
  };

  const createSensorGeoJSON = (sensorData) => {
    const sensorFeatures = sensorData.data
      .filter((sensor) => sensor.lat && sensor.lon)
      .map((sensor) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [sensor.lon, sensor.lat],
        },
        properties: {
          district_id: sensor.district_id,
          division_id: sensor.division_id,
          state_id: sensor.state_id,
          imei_id: sensor.imei_id,
          updated_time: sensor.updated_time,
        },
      }));

    return {
      type: "FeatureCollection",
      features: sensorFeatures,
    };
  };

  const fetchStateGeoData = async () => {
    const { data } = await getGeoDataV2(stateDataLayerName);
    return data;
  };

  const mergeAQAndGeoData = (AQData, geoData, featureName) => {
    if (!AQData || !geoData) {
      console.error("Error: AQData or geoData is undefined");
      return;
    }

    geoData.features.forEach((feature) => {
      const featureNameLower = feature.properties[featureName].toLowerCase();

      const aqDataForFeature = AQData.data.filter(
        (aqData) =>
          aqData[`${featureName}_name`].toLowerCase() === featureNameLower
      );

      if (aqDataForFeature.length > 0) {
        if (!feature.properties.hasOwnProperty("param_values")) {
          feature.properties.param_values = {};
        }

        aqDataForFeature.forEach((aqData) => {
          feature.properties.param_values[aqData.param_name] =
            aqData.param_value;
          feature.properties.number_of_sensors = aqData.number_of_sensors;
        });
      }
    });

    return geoData;
  };

  const mergeSensorAQandGeoData = (sensorAQData, sensorGeoJSON) => {
    if (!sensorAQData || !sensorGeoJSON) {
      console.error("Error: sensorAQData or sensorGeoJSON is undefined");
      return;
    }

    const sensorFeatures = sensorGeoJSON.features;

    sensorFeatures.forEach((sensorFeature) => {
      const imeiId = sensorFeature.properties.imei_id;

      const sensorAQDataForFeature = sensorAQData.data.filter(
        (aqData) => aqData.imei_id === imeiId
      );

      if (sensorAQDataForFeature.length > 0) {
        if (!sensorFeature.properties.hasOwnProperty("param_values")) {
          sensorFeature.properties.param_values = {};
        }

        sensorAQDataForFeature.forEach((aqData) => {
          sensorFeature.properties.param_values[aqData.param_name] =
            aqData.param_value;
        });
      }
    });

    return sensorGeoJSON;
  };

  useEffect(() => {
    fetchData(
      setIsLoading,
      setStatesData,
      setStatesSensorData,
      startDate,
      endDate,
      samplingPeriod,
      samplingValue
    );
  }, [startDate, endDate, samplingPeriod, samplingValue]);

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////  STATE DRILL DOWN  ////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // function to handle double-click on State
  const getStateInfo = (e) => {
    const stateName = e.target.feature.properties.state;
    const stateID = e.target.feature.properties.id;
    const stateBounds = e.target._bounds;

    return { stateName, stateID, stateBounds };
  };

  const buildDivisionAQDataQueryParams = (
    adminLevel,
    startDate,
    endDate,
    samplingPeriod,
    samplingValue
  ) => {
    let AQDataQueryParams = {
      admin_level: adminLevel,
      params: "pm2.5cnc,pm10cnc,temp,humidity,so2ppb,no2ppb,o3ppb,co",
    };

    if (startDate && endDate && samplingPeriod && samplingValue) {
      AQDataQueryParams = {
        ...AQDataQueryParams,
        from_date: startDate,
        to_date: endDate,
        sampling: samplingPeriod || "hours",
        sampling_value: samplingValue || 1,
      };
    }

    return AQDataQueryParams;
  };

  const buildDivisionSensorGeoDataQueryParams = (adminLevel, adminID) => {
    const queryParams = {
      admin_level: adminLevel,
    };

    if (adminID) {
      queryParams.admin_id = adminID;
    }

    return queryParams;
  };

  const fetchDivisionGeoData = async (dataLayerName, cql_filter) => {
    const { data } = await getGeoDataV2(dataLayerName, cql_filter);
    return data;
  };

  const handleStateDrillDownResults = (
    mergedData,
    sensorGeoJSON,
    stateBounds
  ) => {
    setFilteredDivisionGeojson(mergedData);
    setDivisionsSensorData(sensorGeoJSON);
    setIsLoading(false);

    if (mergedData.features.length > 0) {
      setCurrentLayer("Division");
      setBounds(stateBounds);
      setHasDrilledDown(true);
    } else {
      alert("No divisions found for the selected State");
      setSelectedFeature(null);
      setSelectedFeatureName(null);
      setHasDrilledDown(false);
    }

    setLayerNo((prevLayerNo) => prevLayerNo + 1);
  };

  const stateDrillDown = async (e) => {
    // Set loading state
    setIsLoading(true);

    const { stateName, stateID, stateBounds } = getStateInfo(e);

    const cql_filter = `state=\'${stateName.toUpperCase()}\'`;

    const AQDataQueryParams = buildDivisionAQDataQueryParams(
      "division",
      startDate,
      endDate,
      samplingPeriod,
      samplingValue
    );

    const fallbackAQDataQueryParams = buildDivisionAQDataQueryParams(
      "division",
      null
    );

    const sensorGeoDataQueryParams = buildDivisionSensorGeoDataQueryParams(
      "state",
      stateID
    );

    const AQData = await fetchAQData(
      AQDataQueryParams,
      fallbackAQDataQueryParams
    );

    const sensorGeoData = await fetchSensorGeoData(sensorGeoDataQueryParams);
    console.log("Division Sensor Geo Data: ", sensorGeoData);

    const sensorAQData = await fetchSensorAQData(
      AQDataQueryParams,
      fallbackAQDataQueryParams
    );
    console.log("Division Sensor AQ Data: ", sensorAQData);

    const sensorGeoJSON = createSensorGeoJSON(sensorGeoData);
    const mergedSensorData = mergeSensorAQandGeoData(
      sensorAQData,
      sensorGeoJSON
    );
    console.log("Division Merged Sensor Data: ", mergedSensorData);

    const geoData = await fetchDivisionGeoData(
      divisionDataLayerName,
      cql_filter
    );

    const mergedData = mergeAQAndGeoData(AQData, geoData, "division");
    handleStateDrillDownResults(mergedData, mergedSensorData, stateBounds);

    // Update selected state name
    setSelectedState(stateName);
  };

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////  DIVISION DRILL DOWN  /////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // function to handle double-click on a Division
  const getDivisionInfo = (e) => {
    return {
      divisionID: e.target.feature.properties.id,
      divisionName: e.target.feature.properties.division,
      divisionBounds: e.target._bounds,
    };
  };

  const buildDistrictAQDataQueryParams = (
    adminLevel,
    startDate,
    endDate,
    samplingPeriod,
    samplingValue
  ) => {
    let AQDataQueryParams = {
      admin_level: adminLevel,
      params: "pm2.5cnc,pm10cnc,temp,humidity,so2ppb,no2ppb,o3ppb,co",
    };

    if (startDate && endDate && samplingPeriod && samplingValue) {
      AQDataQueryParams = {
        ...AQDataQueryParams,
        from_date: startDate,
        to_date: endDate,
        sampling: samplingPeriod || "hours",
        sampling_value: samplingValue || 1,
      };
    }

    return AQDataQueryParams;
  };

  const buildDistrictSensorGeoDataQueryParams = (adminLevel, adminID) => {
    const queryParams = {
      admin_level: adminLevel,
    };

    if (adminID) {
      queryParams.admin_id = adminID;
    }

    return queryParams;
  };

  const fetchDistrictGeoData = async (dataLayerName, cql_filter) => {
    const { data, isLoading, isError } = await getGeoDataV2(
      dataLayerName,
      cql_filter
    );

    if (isLoading) {
      console.log(`Loading ${dataLayerName} Data...`);
    } else if (isError) {
      console.log(`Error in fetching ${dataLayerName} Data...`);
    }

    return data;
  };

  const handleDivisionDrillDownResults = (
    filteredDistrictsGeojson,
    sensorGeoJSON,
    divisionBounds
  ) => {
    setFilteredDistrictsGeojson(filteredDistrictsGeojson);
    setDistrictsSensorData(sensorGeoJSON);
    setIsLoading(false);

    if (filteredDistrictsGeojson.features.length > 0) {
      setCurrentLayer("District");
      setBounds(divisionBounds);
      setHasDrilledDown(true);
    } else {
      alert("No districts found for the selected Division");
      setSelectedFeature(null);
      setSelectedFeatureName(null);
      setHasDrilledDown(false);
    }

    setLayerNo((prevLayerNo) => prevLayerNo + 1);
  };

  const divisionDrillDown = async (e) => {
    // set loading state
    setIsLoading(true);

    const { divisionID, divisionName, divisionBounds } = getDivisionInfo(e);

    const cql_filter = `division=\'${divisionName}\'`;

    const AQDataQueryParams = buildDistrictAQDataQueryParams(
      "district",
      startDate,
      endDate,
      samplingPeriod,
      samplingValue
    );

    const fallbackAQDataQueryParams = buildDistrictAQDataQueryParams(
      "district",
      null
    );

    const sensorGeoDataQueryParams = buildDistrictSensorGeoDataQueryParams(
      "division",
      divisionID
    );

    const AQData = await fetchAQData(
      AQDataQueryParams,
      buildDistrictAQDataQueryParams("district", null)
    );

    const sensorGeoData = await fetchSensorGeoData(sensorGeoDataQueryParams);
    console.log("District Sensor Geo Data: ", sensorGeoData);

    const sensorAQData = await fetchSensorAQData(
      AQDataQueryParams,
      fallbackAQDataQueryParams
    );
    console.log("District Sensor AQ Data: ", sensorAQData);

    const sensorGeoJSON = createSensorGeoJSON(sensorGeoData);
    const mergedSensorData = mergeSensorAQandGeoData(
      sensorAQData,
      sensorGeoJSON
    );
    console.log("District Merged Sensor Data: ", mergedSensorData);

    const geoData = await fetchDistrictGeoData(
      districtDataLayerName,
      cql_filter
    );

    const mergedData = mergeAQAndGeoData(AQData, geoData, "district");
    handleDivisionDrillDownResults(
      mergedData,
      mergedSensorData,
      divisionBounds
    );

    // Update selected state name
    setSelectedDivision(divisionName);
  };

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////  DISTRICT DRILL DOWN  /////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // function to handle click on a District
  async function districtDrillDown(e) {
    const districtID = e.target.feature.properties.id;
    const districtName = e.target.feature.properties.district;
    const featureBounds = e.target._bounds;

    setBounds(featureBounds);
    setHasDrilledDown(true);
  }

  //===============================================================
  //===============================================================
  //
  // END OF MAIN CODE
  //
  //===============================================================
  //===============================================================

  //===============================================================
  //===============================================================
  //
  // MAIN CODE - DRILL UP
  //
  //===============================================================
  //===============================================================

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////  DRILL UP /////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // This has been shifted to DrillUpButton.jsx component

  //===============================================================
  //===============================================================
  //
  // END OF MAIN CODE
  //
  //===============================================================
  //===============================================================

  // Render map layers based on currentLayer state
  // Polygon Layers
  // India States Layer
  const IndiaLayer = () => {
    return (
      <GeoJSON
        data={statesData}
        style={indiaGeoJSONStyleV1}
        onEachFeature={(feature, layer) => {
          layer.on({
            click: onFeatureClick,
            dblclick: stateDrillDown,
          });
        }}
      />
    );
  };

  // Filtered Divisions Layer
  const FilteredDivisionLayer = () => {
    return (
      <GeoJSON
        data={filteredDivisionsGeojson}
        style={divisionGeoJSONStyleV1}
        onEachFeature={(feature, layer) => {
          layer.on({
            click: onFeatureClick,
            dblclick: divisionDrillDown,
          });
        }}
      />
    );
  };

  // Filtered Districts Layer
  const FilteredDistrictLayer = () => {
    return (
      <GeoJSON
        data={filteredDistrictsGeojson}
        style={districtGeoJSONStyleV1}
        onEachFeature={(feature, layer) => {
          layer.on({
            click: onFeatureClick,
            dblclick: districtDrillDown,
          });
        }}
      />
    );
  };

  // Marker Layers
  // State Sensors Layer
  const StateSensorsLayer = () => {
    return (
      <CustomSensorMarkers
        sensorData={statesSensorData}
        onSensorClick={onSensorClick}
      />
    );
  };

  // Division Sensors Layer
  const DivisionSensorsLayer = () => {
    return (
      <CustomSensorMarkers
        sensorData={divisionsSensorData}
        onSensorClick={onSensorClick}
      />
    );
  };

  // District Sensors Layer
  const DistrictSensorsLayer = () => {
    return (
      <CustomSensorMarkers
        sensorData={districtsSensorData}
        onSensorClick={onSensorClick}
      />
    );
  };

  // render map layers based on currentLayer value
  return (
    <MapContainer
      center={mapCenter}
      zoom={4.75}
      zoomSnap={0.25}
      zoomDelta={1}
      doubleClickZoom={false}
      minZoom={4}
      maxZoom={14}
    >
      <TileLayer url="https://api.mapbox.com/styles/v1/divcsoni99/clf9jbl3d004501qolng7pt76/tiles/256/{z}/{x}/{y}@2x?access_token=pk.eyJ1IjoiZGl2Y3Nvbmk5OSIsImEiOiJjbGYydHV1NDgwNWoyM3NvMXR4bXZra2VyIn0._t8rySAgLoxsMRl0UwvBUg" />
      {/* Render map layers based on currentLayer value */}

      {/* State GeoJSON Layers */}
      {currentLayer === "State" && (
        <>
          {showSensorLayer && <StateSensorsLayer />}
          <IndiaLayer />
        </>
      )}

      {/* Division GeoJSON Layers */}
      {currentLayer === "Division" && (
        <>
          {showSensorLayer && <DivisionSensorsLayer />}
          <FilteredDivisionLayer />
        </>
      )}

      {/* Division GeoJSON Layers */}
      {currentLayer === "District" && (
        <>
          {showSensorLayer && <DistrictSensorsLayer />}
          <FilteredDistrictLayer />
        </>
      )}

      {/* Fit Map Bounds */}
      {bounds.length !== 0 && <ZoomtoBounds bounds={bounds} />}
    </MapContainer>
  );
}

export default LeafletMap;
