// This component is used to create custom markers for the sensors on the map.

// react imports
import React, { useContext } from "react";

// react-leaflet imports
import { Marker } from "react-leaflet";
import L from "leaflet";

// utils imports
import roundOffFull from "../utils/roundOffFull";

// styles imports
import "../styles/CustomSensorMarkers.css";

// contexts imports
import DataContext from "../contexts/Data.Context";

// function to create custom icon for the marker
const createCustomIcon = (feature, selectedPollutant) => {
  let paramValue = "";
  if (feature.properties && feature.properties.param_values) {
    paramValue =
      roundOffFull(feature.properties.param_values[selectedPollutant]) ?? "-";
  }

  return L.divIcon({
    className: "custom-icon",
    html: `<div class="custom-icon-marker">${paramValue}</div>`,
  });
};

// component to create custom markers for the sensors on the map
// it displays the value of the selected pollutant for the sensor in a circular marker
const CustomSensorMarkers = ({ sensorData, onSensorClick }) => {
  const { selectedPollutant } = useContext(DataContext);

  return (
    <>
      {sensorData.features.map((feature, index) => {
        const customIcon = createCustomIcon(feature, selectedPollutant);
        const position = [
          feature.geometry.coordinates[1],
          feature.geometry.coordinates[0],
        ];

        return (
          <Marker
            key={index}
            position={position}
            icon={customIcon}
            eventHandlers={{ click: () => onSensorClick(feature) }}
          />
        );
      })}
    </>
  );
};

export default CustomSensorMarkers;
