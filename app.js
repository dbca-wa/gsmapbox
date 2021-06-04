// Restricted token for specific departmental domains
mapboxgl.accessToken = 'pk.eyJ1IjoiZHBhd2FzaSIsImEiOiJja3BocXNyaW4ybnpnMm9sbDA0cGg3MjRkIn0.RksyGCIk8ljgFmm7K0YQ3w';
window.map = new mapboxgl.Map({
    container: 'map', // container id
    style: 'mapbox://styles/dpawasi/ckigwmxrx606g19msw0g882gj', // style URL
    center: [120, -25], // starting position [lng, lat]
    zoom: 5 // starting zoom
});

function load(data) {
    let layers = {};
    let defaultLayer = false;
    let defaultWorkspace = false;
    let workspaces = new Set();
    let parser = new DOMParser()
    parser.parseFromString(data, "text/xml").querySelectorAll("FeatureType").forEach(elem => {
        let layerid = elem.querySelector("Name").textContent;
        let ws = layerid.split(":")[0];
        workspaces.add(ws);
        layers[layerid] = elem.querySelector("Title").textContent;
        if (defaultLayer === false) {
            defaultLayer = layerid;
            defaultWorkspace = ws;
        }
    })
    window.wfslayers = layers;
    const Controls = {
        data() {
            return {
                layer: defaultLayer,
                workspace: defaultWorkspace,
                workspaces: workspaces,
                alllayers: layers,
                cql: "",
                maplayerid: "wfsdata",
                features: []
            }
        },
        computed: {
            layers() {
                let ws = this.workspace;
                return Object.entries(this.alllayers).filter(layer => layer[0].search(ws) === 0)
            },
            base_url() {
                let base = `/geoserver/${this.workspace}/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=${this.layer}`
                if (this.cql.length > 0) { base = `${base}&cql_filter=${encodeURIComponent(this.cql)}` }
                return base;
            }
        },
        methods: {
            url(format) {
                return `${this.base_url}&outputFormat=${format}`
            },
            updatemap() {
                let vuedata = this;
                let id = this.maplayerid
                let types = [
                    ["Polygon", "fill"],
                    ["LineString", "line"],
                    ["Point", "circle"]
                ]
                for (let type of types) {
                    if (map.getLayer(type[0])) { map.removeLayer(type[0]); }
                }
                if (map.getSource(id)) { map.removeSource(id); }
                map.addSource(id, { type: "geojson", data: `${this.url('json')}&maxFeatures=1000` });
                fetch(map.getSource("wfsdata")._data).then(response => response.json()).then(data => vuedata.features = data["features"]);
                for (let type of types) {
                    map.addLayer({ 'id': type[0], 'type': type[1], 'source': id, 'filter': ['==', '$type', type[0]] })
                }
            }
        }
    }
    Vue.createApp(Controls).mount('#controls')
}

var wfsurl = "/geoserver/ows?service=wfs&version=2.0.0&request=GetCapabilities"
fetch(wfsurl).then(response => response.text()).then(data => load(data));