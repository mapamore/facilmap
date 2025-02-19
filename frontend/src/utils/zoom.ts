import { LatLng, latLng, LatLngBounds, latLngBounds, Map } from "leaflet";
import { fmToLeafletBbox, HashQuery } from "facilmap-leaflet";
import { RouteWithTrackPoints } from "facilmap-client";
import { SelectedItem } from "./selection";
import { FindOnMapLine, FindOnMapMarker, FindOnMapResult, Line, Marker, SearchResult } from "facilmap-types";
import { Geometry } from "geojson";
import { isMapResult } from "./search";
import { MapComponents } from "../map/leaflet-map/leaflet-map";
import { decodeLonLatUrl } from "facilmap-utils";
import { EventBus } from "../map/leaflet-map/events";
import { Client } from "./decorators";
import StringMap from "./string-map";

export type ZoomDestination = {
	center?: LatLng;
	zoom?: number;
	bounds?: LatLngBounds;
};

export function getZoomDestinationForGeoJSON(geojson: Geometry): ZoomDestination | undefined {
	if (geojson.type == "GeometryCollection")
		return combineZoomDestinations(geojson.geometries.map((geo) => getZoomDestinationForGeoJSON(geo)));
	else if (geojson.type == "Point")
		return { center: latLng(geojson.coordinates[1], geojson.coordinates[0]) };
	else if (geojson.type == "LineString" || geojson.type == "MultiPoint")
		return combineZoomDestinations(geojson.coordinates.map((pos) => ({ center: latLng(pos[1], pos[0]) })));
	else if (geojson.type == "Polygon" || geojson.type == "MultiLineString")
		return combineZoomDestinations(geojson.coordinates.flat().map((pos) => ({ center: latLng(pos[1], pos[0]) })));
	else if (geojson.type == "MultiPolygon")
		return combineZoomDestinations(geojson.coordinates.flat().flat().map((pos) => ({ center: latLng(pos[1], pos[0]) })));
	else
		return undefined;
}

export function getZoomDestinationForMarker(marker: Marker<StringMap> | FindOnMapMarker): ZoomDestination {
	return { center: latLng(marker.lat, marker.lon), zoom: 15 };
}

export function getZoomDestinationForLine(line: Line<StringMap> | FindOnMapLine): ZoomDestination {
	return { bounds: fmToLeafletBbox(line) };
}

export function getZoomDestinationForRoute(route: RouteWithTrackPoints): ZoomDestination {
	return { bounds: fmToLeafletBbox(route) };
}

export function getZoomDestinationForSearchResult(result: SearchResult): ZoomDestination | undefined {
	const dest: ZoomDestination = {};

	if (result.boundingbox)
		dest.bounds = latLngBounds([[result.boundingbox[0], result.boundingbox[3]], [result.boundingbox[1], result.boundingbox[2]]]);
	else if (result.geojson)
		dest.bounds = getZoomDestinationForGeoJSON(result.geojson)?.bounds;
	
	if (result.lat && result.lon)
		dest.center = latLng(Number(result.lat), Number(result.lon));
	else if (result.geojson)
		dest.center = getZoomDestinationForGeoJSON(result.geojson)?.center;

	if (result.zoom != null)
		dest.zoom = result.zoom;

	return Object.keys(dest).length == 0 ? undefined : dest;
}

export function getZoomDestinationForMapResult(result: FindOnMapResult): ZoomDestination {
	if (result.kind == "marker")
		return getZoomDestinationForMarker(result);
	else
		return getZoomDestinationForLine(result);
}

export function getZoomDestinationForResults(results: Array<SearchResult | FindOnMapResult>): ZoomDestination | undefined {
	return combineZoomDestinations(results
		.map((result) => (isMapResult(result) ? getZoomDestinationForMapResult(result) : getZoomDestinationForSearchResult(result)))
		.filter((result) => !!result) as ZoomDestination[]
	);
}

export function combineZoomDestinations(destinations: Array<ZoomDestination | undefined>): ZoomDestination | undefined {
	if (destinations.length == 0)
		return undefined;
	else if (destinations.length == 1)
		return destinations[0];
	
	const bounds = latLngBounds(undefined as any);
	for (const destination of destinations) {
		if (destination)
			bounds.extend((destination.bounds || destination.center)!);
	}
	return { bounds };
}

export function normalizeZoomDestination(map: Map, destination: ZoomDestination): Required<ZoomDestination> & Pick<ZoomDestination, "bounds"> {
	const result = { ...destination };
	if (result.center == null)
		result.center = destination.bounds!.getCenter();
	if (result.zoom == null)
		result.zoom = result.bounds ? Math.min(15, map.getBoundsZoom(result.bounds)) : 15;
	return result as any;
}

export function flyTo(map: Map, destination: ZoomDestination, smooth = true): void {
	const dest = normalizeZoomDestination(map, destination);
	if (map._loaded && smooth)
		map.flyTo(dest.center, dest.zoom);
	else
		map.setView(dest.center, dest.zoom, { animate: false });
}

export function getHashQuery(map: Map, client: Client, items: SelectedItem[]): HashQuery | undefined {
	if (items.length == 1) {
		if (items[0].type == "searchResult") {
			const destination = getZoomDestinationForSearchResult(items[0].result);
			if (items[0].result.id && destination)
				return { query: items[0].result.id, ...normalizeZoomDestination(map, destination) };
			else
				return undefined;
		} else if (items[0].type == "marker") {
			const marker = client.markers[items[0].id];
			return {
				query: `m${items[0].id}`,
				...(marker ? normalizeZoomDestination(map, getZoomDestinationForMarker(marker)) : {})
			};
		} else if (items[0].type == "line") {
			const line = client.lines[items[0].id];
			return {
				query: `l${items[0].id}`,
				...(line ? normalizeZoomDestination(map, getZoomDestinationForLine(line)) : {})
			};
		}
	}

	return undefined;
}

export async function openSpecialQuery(query: string, client: Client, mapComponents: MapComponents, mapContext: EventBus, zoom: boolean, smooth = true): Promise<boolean> {
	if(query.match(/ to /i)) {
		mapContext.$emit("fm-route-set-query", query, zoom, smooth);
		mapContext.$emit("fm-search-box-show-tab", "fm-route-form-tab");
		return true;
	}

	const lonlat = decodeLonLatUrl(query);
	if(lonlat) {
		if (zoom)
			flyTo(mapComponents.map, { center: latLng(lonlat.lat, lonlat.lon), zoom: lonlat.zoom }, smooth);
		return true;
	}

	const markerId = Number(query.match(/^m(\d+)$/)?.[1]);
	if (markerId) {
		let marker = client.markers[markerId];
		if (!marker) {
			try {
				marker = await client.getMarker({ id: markerId });
			} catch (err) {
				console.error("Could not find marker", err);
			}
		}

		if (marker) {
			mapComponents.selectionHandler.setSelectedItems([{ type: "marker", id: marker.id }]);
		
			if (zoom)
				flyTo(mapComponents.map, getZoomDestinationForMarker(marker), smooth);
			
			setTimeout(() => {
				mapContext.$emit("fm-search-box-show-tab", "fm-marker-info-tab");
			}, 0);

			return true;
		}
	}

	const lineId = Number(query.match(/^l(\d+)$/)?.[1]);
	if (lineId && client.lines[lineId]) {
		const line = client.lines[lineId];

		mapComponents.selectionHandler.setSelectedItems([{ type: "line", id: line.id }]);
		
		if (zoom)
			flyTo(mapComponents.map, getZoomDestinationForLine(line), smooth);
		
		setTimeout(() => {
			mapContext.$emit("fm-search-box-show-tab", "fm-line-info-tab");
		}, 0);

		return true;
	}

	return false;
}