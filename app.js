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
    let alllayers = [];
    let parser = new DOMParser()
    parser.parseFromString(data, "text/xml").querySelectorAll("FeatureType").forEach(elem => {
        let name = elem.querySelector("Name").textContent
        alllayers.push({
            "title": elem.querySelector("Title").textContent,
            "name": name,
            "workspace": name.split(":")[0]
        });
    })
    const Controls = {
        data() {
            return {
                cql: "",
                layer: "",
                workspace: "",
                loading: false,
                alllayers: alllayers,
                json: {}
            }
        },
        computed: {
            layers() {
                let search = this.layer;
                if (search.length > 0) {
                    if (this.picked.length == 1) {
                        return this.picked;
                    } else {
                        // Treat input layer as case insensitive regex if not an exact match
                        return this.alllayers.filter(layer => `${layer.name} (${layer.title})`.match(new RegExp(search, "i")));
                    }
                }
                return this.alllayers;
            },
            picked() {
                let search = this.layer;
                return this.alllayers.filter(layer => layer.name == search);
            },
            base_url() {
                let base = `/geoserver/${this.workspace}/ows?service=WFS&version=2.0.0&request=GetFeature&SRSName=EPSG:4326&typeNames=${this.layer}`
                if (this.cql.length > 0) { base = `${base}&cql_filter=${encodeURIComponent(this.cql)}` }
                return base;
            }
        },
        methods: {
            set(lyr) {
                this.layer = lyr.name;
                this.workspace = lyr.workspace;
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
                this.loading = false;
            },
            setcqlbounds() {
                if (this.cql.length > 0) { this.cql += " AND " }
                bounds = map.getBounds();
                this.cql = `${this.cql.split("BBOX")[0]}BBOX(${this.json.features[0].geometry_name},${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()})`
                this.updatemap();
            },
            addLayers(srcid) { // add display layers with source id
                map.addLayer({
                    "id": "Polygon", "type": "fill", "source": id,
                    "filter": ['==', '$type', "Polygon"],
                    "paint": {
                        'fill-color': 'blue',
                        'fill-opacity': 0.4
                    }
                });
                map.addLayer({
                    "id": "LineString", "type": "line", "source": id,
                    "filter": ['any', ['==', '$type', "LineString"], ['==', '$type', "Polygon"]],
                    "paint": {
                        'line-color': 'blue',
                        'line-opacity': 0.7,
                        'line-width': 3
                    }
                });
                map.addLayer({
                    "id": "Point", "type": "circle", "source": id,
                    "filter": ['==', '$type', "Point"],
                    "paint": {
                        'circle-radius': 6,
                        'circle-stroke-width': 2,
                        'circle-color': 'red',
                        'circle-stroke-color': 'white',
                        'circle-opacity': 0.8
                    }
                });
            },
            updatemap() {
                this.loading = `Loading ${this.layer} ...`;
                document.location.hash = encodeURIComponent(JSON.stringify({
                    ws: this.workspace,
                    lyr: this.layer,
                    cql: this.cql
                }));
                let vuedata = this;
                let id = "wfsdata"
                for (let type of ["Polygon", "LineString", "Point"]) {
                    if (map.getLayer(type)) { map.removeLayer(type); }
                }
                if (map.getSource(id)) { map.removeSource(id); }
                fetch(`${this.url('json')}&count=1000`).then(response => response.clone().json().catch(() => response.text())).then(data => {
                    if (data.features && data.features.length > 0) {
                        vuedata.json = data;
                        map.addSource(id, { type: "geojson", data: data });
                        vuedata.addLayers(id);
                        map.fitBounds(turf.bbox(data));
                        vuedata.loading = false;
                    } else if (!data.features) {
                        vuedata.json = data;
                        vuedata.loading = false;
                    }
                });

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