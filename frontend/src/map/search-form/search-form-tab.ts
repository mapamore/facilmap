import WithRender from "./search-form-tab.vue";
import Vue from "vue";
import { Component, Ref } from "vue-property-decorator";
import { InjectMapComponents, InjectMapContext } from "../../utils/decorators";
import SearchForm from "./search-form";
import "./search-form-tab.scss";
import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
import { Util } from "leaflet";
import { HashQuery } from "facilmap-leaflet";

@WithRender
@Component({
	components: { SearchForm }
})
export default class SearchFormTab extends Vue {

	@InjectMapContext() mapContext!: MapContext;
	@InjectMapComponents() mapComponents!: MapComponents;

	@Ref() searchForm!: SearchForm;

	hashQuery: HashQuery | null | undefined = null;

	mounted(): void {
		this.mapContext.$on("fm-open-selection", this.handleOpenSelection);
		this.mapContext.$on("fm-search-set-query", this.handleSetQuery);
	}

	beforeDestroy(): void {
		this.mapContext.$off("fm-open-selection", this.handleOpenSelection);
		this.mapContext.$off("fm-search-set-query", this.handleSetQuery);
	}

	handleOpenSelection(): void {
		const layerId = Util.stamp(this.mapComponents.searchResultsLayer);
		if (this.mapContext.selection.some((item) => item.type == "searchResult" && item.layerId == layerId))
			this.mapContext.$emit("fm-search-box-show-tab", "fm-search-form-tab");
	}

	handleSetQuery(query: string, zoom = false, smooth = true): void {
		this.searchForm.setSearchString(query);
		this.searchForm.search(zoom, undefined, smooth);
	}

}