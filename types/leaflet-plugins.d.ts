import "leaflet";

declare module "leaflet" {
  namespace Control {
    function geocoder(options?: Record<string, unknown>): Control;
  }

  function markerClusterGroup(options?: Record<string, unknown>): LayerGroup;
}
