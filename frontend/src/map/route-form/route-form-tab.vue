<b-tab title="Route" id="fm-route-form-tab" :active.sync="tabActive" :fm-hash-query="hashQuery">
	<RouteForm :active="tabActive" @activate="activate()" ref="routeForm" @hash-query-change="hashQuery = $event"></RouteForm>
</b-tab>