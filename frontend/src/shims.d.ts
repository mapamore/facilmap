declare module "*.vue" {
    import Vue, { ComponentOptions, FunctionalComponentOptions } from 'vue';

    interface WithRender {
        <V extends Vue, U extends ComponentOptions<V> | FunctionalComponentOptions>(options: U): U
        <V extends typeof Vue>(component: V): V
    }
    const withRender: WithRender;
    export default withRender;
}

declare module "vue-color" {
    export const ColorMixin: any;
    export const Hue: any;
    export const Saturation: any;
}

declare module "@tmcw/togeojson" {
    export const gpx: any;
    export const kml: any;
    export const tcx: any;
}

declare module "vue-nonreactive" {
    export default function nonreactive(obj: ConstructorType<Vue>): void;
}