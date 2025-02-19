import WithRender from "./leaflet-map.vue";
import Vue from "vue";
import { Component, ProvideReactive, Ref, Watch } from "vue-property-decorator";
import "./leaflet-map.scss";
import { Client, InjectClient, MAP_COMPONENTS_INJECT_KEY, MAP_CONTEXT_INJECT_KEY } from "../../utils/decorators";
import L, { LatLng, Map } from "leaflet";
import "leaflet/dist/leaflet.css";
import { BboxHandler, getSymbolHtml, displayView, getInitialView, getVisibleLayers, HashHandler, LinesLayer, MarkersLayer, SearchResultsLayer, VisibleLayers, HashQuery } from "facilmap-leaflet";
import "leaflet.locatecontrol";
import "leaflet.locatecontrol/dist/L.Control.Locate.css";
import "leaflet-graphicscale";
import "leaflet-graphicscale/src/Leaflet.GraphicScale.scss";
import "leaflet-mouse-position";
import "leaflet-mouse-position/src/L.Control.MousePosition.css";
import $ from "jquery";
import SelectionHandler, { SelectedItem } from "../../utils/selection";
import { FilterFunc } from "facilmap-utils";
import { getHashQuery, openSpecialQuery } from "../../utils/zoom";
import context from "../context";
import { createEventBus, EventBus } from "./events";

/* function createButton(symbol: string, onClick: () => void): Control {
    return Object.assign(new Control(), {
        onAdd() {
            const div = document.createElement('div');
            div.className = "leaflet-bar";
            const a = document.createElement('a');
            a.href = "javascript:";
            a.innerHTML = createSymbolHtml("currentColor", "1.5em", symbol);
            a.addEventListener("click", (e) => {
                e.preventDefault();
                onClick();
            });
            div.appendChild(a);
            return div;
        }
    });
} */

export interface MapComponents {
    bboxHandler: BboxHandler;
    container: HTMLElement;
    graphicScale: any;
    hashHandler: HashHandler;
    linesLayer: LinesLayer;
    locateControl: L.Control.Locate;
    map: Map;
    markersLayer: MarkersLayer;
    mousePosition: L.Control.MousePosition;
    searchResultsLayer: SearchResultsLayer;
    selectionHandler: SelectionHandler;
}

export interface MapContext extends EventBus {
    center: LatLng;
    zoom: number;
    layers: VisibleLayers;
    filter: string | undefined;
    filterFunc: FilterFunc;
    hash: string;
    showToolbox: boolean;
    selection: SelectedItem[];
    fallbackQuery: HashQuery | undefined; // Updated by search-box
    interaction: boolean;
}

@WithRender
@Component({
    components: { }
})
export default class LeafletMap extends Vue {

    @InjectClient() client!: Client;

    @ProvideReactive(MAP_COMPONENTS_INJECT_KEY) mapComponents: MapComponents = null as any;
    @ProvideReactive(MAP_CONTEXT_INJECT_KEY) mapContext: MapContext = null as any;

    @Ref() innerContainer!: HTMLElement;

    loaded = false;
    interaction = 0;

    get isNarrow(): boolean {
        return context.isNarrow;
    }

    get selfUrl(): string {
        return `${location.origin}${location.pathname}${this.mapContext?.hash ? `#${this.mapContext.hash}` : ''}`;
    }

    get isInFrame(): boolean {
        return context.isInFrame;
    }

    mounted(): void {
        const el = this.$el.querySelector(".fm-leaflet-map") as HTMLElement;
        const map = L.map(el, { boxZoom: false });

        map._controlCorners.bottomcenter = L.DomUtil.create("div", "leaflet-bottom fm-leaflet-center", map._controlContainer);

        const bboxHandler = new BboxHandler(map, this.client).enable();
        const container = this.innerContainer;
        const graphicScale = L.control.graphicScale({ fill: "hollow", position: "bottomcenter" }).addTo(map);
        const hashHandler = new HashHandler(map, this.client).on("fmQueryChange", this.handleNewHashQuery).enable();
        const linesLayer = new LinesLayer(this.client).addTo(map);
        const locateControl = L.control.locate({ flyTo: true, icon: "a", iconLoading: "a", markerStyle: { pane: "fm-raised-marker", zIndexOffset: 10000 } }).addTo(map);
        const markersLayer = new MarkersLayer(this.client).addTo(map);
        const mousePosition = L.control.mousePosition({ emptyString: "0, 0", separator: ", ", position: "bottomright" }).addTo(map);
        const searchResultsLayer = new SearchResultsLayer(undefined, { pathOptions: { weight: 7 } }).addTo(map);
        const selectionHandler = new SelectionHandler(map, markersLayer, linesLayer, searchResultsLayer).enable();

        this.mapComponents = Vue.nonreactive({ bboxHandler, container, graphicScale, hashHandler, linesLayer, locateControl, map,markersLayer, mousePosition, searchResultsLayer, selectionHandler });
        for (const i of Object.keys(this.mapComponents) as Array<keyof MapComponents>)
            Vue.nonreactive(this.mapComponents[i]);

        $(this.mapComponents.locateControl._container).find("a").append(getSymbolHtml("currentColor", "1.5em", "screenshot"));

        (async () => {
            if (!map._loaded) {
                try {
                    // Initial view was not set by hash handler
                    displayView(map, await getInitialView(this.client));
                } catch (error) {
                    console.error(error);
                    displayView(map);
                }
            }
            this.loaded = true;
        })();

        this.mapContext = {
            center: map._loaded ? map.getCenter() : L.latLng(0, 0),
            zoom: map._loaded ? map.getZoom() : 1,
            layers: getVisibleLayers(map),
            filter: map.fmFilter,
            filterFunc: map.fmFilterFunc,
            hash: location.hash.replace(/^#/, ""),
            showToolbox: false,
            selection: [],
            fallbackQuery: undefined,
            interaction: false,
            ...createEventBus()
        };

        map.on("moveend", () => {
            this.mapContext.center = map.getCenter();
            this.mapContext.zoom = map.getZoom();
        });

        map.on("fmFilter", () => {
            this.mapContext.filter = map.fmFilter;
            this.mapContext.filterFunc = map.fmFilterFunc;
        });

        map.on("layeradd layerremove", () => {
            this.mapContext.layers = getVisibleLayers(map);
        });

        map.on("fmInteractionStart", () => {
            this.interaction++;
            this.mapContext.interaction = true;
        });

        map.on("fmInteractionEnd", () => {
            this.interaction--;
            this.mapContext.interaction = this.interaction > 0;
        });

        hashHandler.on("fmHash", (e: any) => {
            this.mapContext.hash = e.hash;
        });

        selectionHandler.on("fmChangeSelection", (event: any) => {
            const selection = selectionHandler.getSelection();
            Vue.set(this.mapContext, "selection", selection);

            if (event.open) {
                setTimeout(() => {
                    this.mapContext.$emit("fm-open-selection", selection);
                }, 0);
            }
        });

        selectionHandler.on("fmLongClick", (event: any) => {
            this.mapContext.$emit("fm-map-long-click", { lat: event.latlng.lat, lon: event.latlng.lng });
        });
    }

    get activeQuery(): HashQuery | undefined {
        if (!this.mapContext) // Not mounted yet
            return undefined;
        return getHashQuery(this.mapComponents.map, this.client, this.mapContext.selection) || this.mapContext.fallbackQuery;
    }

    @Watch("activeQuery")
    handleActiveQueryChange(query: HashQuery | undefined): void {
        this.mapComponents.hashHandler.setQuery(query);
    }

    async handleNewHashQuery(e: any): Promise<void> {
        if (!e.query)
            return;

        let smooth = true;
        if (!this.mapComponents) {
            // This is called while the hash handler is being enabled, so it is the initial view
            smooth = false;
            await new Promise((resolve) => { setTimeout(resolve); });
        }

        if (!await openSpecialQuery(e.query, this.client, this.mapComponents, this.mapContext, e.zoom, smooth))
            this.mapContext.$emit("fm-search-set-query", e.query, e.zoom, smooth);
    }

}