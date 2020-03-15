import { Bbox, ExportFormat, ID, ObjectWithId } from "./base";
import { PadData, PadDataCreate, PadDataUpdate } from "./padData";
import { Marker, MarkerCreate, MarkerUpdate } from "./marker";
import { Line, LineCreate, LineUpdate } from "./line";
import { Route, RouteCreate } from "./route";
import { Type, TypeCreate, TypeUpdate } from "./type";
import { View, ViewCreate, ViewUpdate } from "./view";
import { MultipleEvents } from "./events";
import { SearchResult } from "./searchResult";

export interface LineTemplateRequest {
	typeId: ID
}

export interface LineExportRequest {
	id: ID;
	format: ExportFormat
}

export interface RouteExportRequest {
	format: ExportFormat
}

export interface FindQuery {
	query: string;
	loadUrls?: boolean;
	elevation?: boolean;
}

export interface FindOnMapQuery {
	query: string;
}

export interface RequestDataMap {
	updateBbox: Bbox;
	createPad: PadDataCreate;
	editPad: PadDataUpdate;
	listenToHistory: void;
	stopListeningToHistory: void;
	revertHistoryEntry: ObjectWithId;
	getMarker: ObjectWithId;
	addMarker: MarkerCreate;
	editMarker: MarkerUpdate;
	deleteMarker: ObjectWithId;
	getLineTemplate: LineTemplateRequest;
	addLine: LineCreate;
	editLine: LineUpdate;
	deleteLine: ObjectWithId;
	exportLine: LineExportRequest;
	find: FindQuery;
	findOnMap: FindOnMapQuery;
	getRoute: RouteCreate;
	setRoute: RouteCreate;
	clearRoute: void;
	lineToRoute: ObjectWithId;
	exportRoute: RouteExportRequest;
	addType: TypeCreate;
	editType: TypeUpdate;
	deleteType: ObjectWithId;
	addView: ViewCreate;
	editView: ViewUpdate;
	deleteView: ObjectWithId;
	geoip: void;
	setPadId: string;
}

export interface ResponseDataMap {
	updateBbox: MultipleEvents;
	createPad: MultipleEvents;
	editPad: PadData;
	listenToHistory: MultipleEvents;
	stopListeningToHistory: void;
	revertHistoryEntry: MultipleEvents;
	getMarker: Marker;
	addMarker: Marker;
	editMarker: Marker;
	deleteMarker: Marker;
	getLineTemplate: Line;
	addLine: Line;
	editLine: Line;
	deleteLine: Line;
	exportLine: string;
	find: string | SearchResult[];
	findOnMap: Array<Pick<Marker, "id" | "name" | "typeId" | "lat" | "lon"> | Pick<Line, "id" | "name" | "typeId" | "left" | "top" | "right" | "bottom">>;
	getRoute: Route;
	setRoute: Route;
	clearRoute: void;
	lineToRoute: Route;
	exportRoute: string;
	addType: Type;
	editType: Type;
	deleteType: Type;
	addView: View;
	editView: View;
	deleteView: View;
	geoip: Bbox | null;
	setPadId: MultipleEvents;
}

export type RequestName = keyof RequestDataMap;
export type RequestData<E extends RequestName> = RequestDataMap[E];
export type ResponseData<E extends RequestName> = ResponseDataMap[E];
