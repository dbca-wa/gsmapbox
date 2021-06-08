// Restricted token for specific departmental domains
mapboxgl.accessToken = 'pk.eyJ1IjoiZHBhd2FzaSIsImEiOiJja3BocXNyaW4ybnpnMm9sbDA0cGg3MjRkIn0.RksyGCIk8ljgFmm7K0YQ3w';
window.map = new mapboxgl.Map({
    container: 'map', // container id
    style: 'mapbox://styles/dpawasi/ckigwmxrx606g19msw0g882gj', // style URL
    center: [120, -25], // starting position [lng, lat]
    zoom: 4 // starting zoom
});
map.addControl(new MapboxGeocoder({ accessToken: mapboxgl.accessToken, mapboxgl: mapboxgl, bbox: [105.7, -38.5, 130.5, -10.6] })); // WA bounding box
map.addControl(new mapboxgl.GeolocateControl());
map.addControl(new mapboxgl.ScaleControl());

function load(data) {
    let layers = {};
    let defaultLayer = false;
    let defaultWorkspace = false;
    let defaultCQL = "";
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
                cql: defaultCQL,
                maplayerid: "wfsdata",
                json: {}
            }
        },
        computed: {
            layers() {
                let lyr = this.layer;
                results = Object.entries(this.alllayers)
                if (lyr.length > 0) {
                    picked = results.filter(layer => layer[0] == lyr);
                    if (picked.length == 1) { return picked; } else {
                        results = results.filter(layer => JSON.stringify(layer).search(lyr) > -1);
                    }
                }
                return results;
            },
            base_url() {
                let base = `/geoserver/${this.workspace}/ows?service=WFS&version=2.0.0&request=GetFeature&SRSName=EPSG:4326&typeNames=${this.layer}`
                if (this.cql.length > 0) { base = `${base}&cql_filter=${encodeURIComponent(this.cql)}` }
                return base;
            }
        },
        methods: {
            set(lyr) {
                this.layer = lyr[0];
                this.workspace = lyr[0].split(":")[0];
                this.updatemap();
            },
            url(format) {
                return `${this.base_url}&outputFormat=${format}`
            },
            xmlerror() {
                let parser = new DOMParser();
                let exceptiontext = parser.parseFromString(this.json, "text/xml").querySelector('ExceptionText');
                if (exceptiontext) {
                    return parser.parseFromString('<!doctype html><body>' + exceptiontext.textContent, 'text/html').body.textContent.trim();
                };
                return "";
            },
            reset() {
                this.layer = '';
                this.cql = '';
                this.json = '';
            },
            setcqlbounds() {
                if (this.cql.length > 0) { this.cql += " AND " }
                bounds = map.getBounds();
                this.cql = `${this.cql.split("BBOX")[0]}BBOX(${this.json.features[0].geometry_name},${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()})`
                this.updatemap();
            },
            updatemap() {
                document.location.hash = encodeURIComponent(JSON.stringify({
                    ws: this.workspace,
                    lyr: this.layer,
                    cql: this.cql
                }));
                let vuedata = this;
                let id = this.maplayerid
                let types = [
                    ["Polygon", "fill", {
                        'fill-color': 'blue',
                        'fill-opacity': 0.4
                    }],
                    ["LineString", "line", {
                        'line-color': 'blue',
                        'line-opacity': 0.7,
                        'line-width': 3
                    }],
                    ["Point", "circle", {
                        'circle-radius': 8,
                        'circle-stroke-width': 2,
                        'circle-color': 'red',
                        'circle-stroke-color': 'white',
                        'circle-opacity': 0.8
                    }]
                ]
                for (let type of types) {
                    if (map.getLayer(type[0])) { map.removeLayer(type[0]); }
                }
                if (map.getSource(id)) { map.removeSource(id); }
                map.addSource(id, { type: "geojson", data: `${this.url('json')}&count=1000` });
                fetch(map.getSource("wfsdata")._data).then(response => response.clone().json().catch(() => response.text())).then(data => {
                    if (data.features && data.features.length > 0) {
                        vuedata.json = data;
                        map.fitBounds(turf.bbox(data));
                    } else if (!data.features) {
                        vuedata.json = data;
                    }
                });
                for (let type of types) {
                    map.addLayer({
                        'id': type[0], 'type': type[1], 'source': id, 'filter': ['==', '$type', type[0]], 'paint': type[2]
                    })
                }
            }
        }
    }
    window.app = Vue.createApp(Controls).mount('#controls')
    if (document.location.hash) {
        savedurl = JSON.parse(decodeURIComponent(document.location.hash.slice(1)));
        app.$data.workspace = savedurl["ws"];
        app.$data.layer = savedurl["lyr"];
        app.$data.cql = savedurl["cql"];
        app.updatemap();
    }
}

var wfsurl = "/geoserver/ows?service=wfs&version=2.0.0&request=GetCapabilities"
map.on('load', () => { fetch(wfsurl).then(response => response.text()).then(data => load(data)) });