import os
import sys
import pytest

os.environ['DB_HOST'] = 'localhost'

# Add src directory to path to import server module
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src')))

import server
from server import app

@pytest.fixture(scope='session')
def client():
    # Use Flask test client for real HTTP-like requests
    app.testing = True
    return app.test_client()

@pytest.fixture(scope='session')
def first_dataset(client):
    # Fetch first dataset via the search endpoint for use in downstream tests
    resp = client.get('/api/search-http', query_string={'term': 'water'})
    assert resp.status_code == 200, "Search endpoint failed"
    data = resp.get_json()
    assert isinstance(data, list), "Expected list of datasets"
    if not data:
        pytest.skip("No datasets found for search; skipping dependent tests")
    return data[0]


def test_search_http(client):
    resp = client.get('/api/search-http', query_string={'term': 'water'})
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, list)
    assert data, "Expected non-empty list of results"
    # Check minimal fields in result
    assert 'uuid' in data[0]
    assert 'title' in data[0]


def test_get_default_download_url(client, first_dataset):
    uuid = first_dataset['uuid']
    resp = client.get(f'/api/get-default-download-url/{uuid}')
    # Could be allowed, not found, or restricted
    assert resp.status_code in (200, 404, 403)
    data = resp.get_json()
    assert 'downloadUrl' in data or 'error' in data


def test_get_download_formats(client, first_dataset):
    uuid = first_dataset['uuid']
    resp = client.get(f'/api/get-download-formats/{uuid}')
    if resp.status_code == 200:
        data = resp.get_json()
        assert isinstance(data, list)
    else:
        assert resp.status_code == 404


def test_download_dataset(client, first_dataset):
    uuid = first_dataset['uuid']
    raw_formats = first_dataset.get('downloadFormats') or []
    if not raw_formats:
        pytest.skip("No download formats available; skipping download test")
    area = raw_formats[0]
    projections = area.get('projections') or []
    if not projections:
        pytest.skip("No projections in area; skipping download test")
    proj = projections[0]
    formats_list = proj.get('formats') or []
    if not formats_list:
        pytest.skip("No formats in projection; skipping download test")
    fmt = formats_list[0]
    download_spec = {
        "areaName": area.get("name"),
        "areaCode": area.get("code"),
        "areaType": area.get("type"),
        "projectionName": proj.get("name"),
        "projectionCode": proj.get("code"),
        "projectionCodespace": proj.get("codespace", ""),
        "formatName": fmt.get("name"),
        "formatCode": fmt.get("code"),
        "formatType": fmt.get("type", ""),
        "userGroup": "GeoGPT",
        "usagePurpose": "GeoGPT",
    }
    payload = {"metadataUuid": uuid, "downloadFormats": download_spec}
    resp = client.post('/api/download-dataset', json=payload)
    assert resp.status_code in (200, 403, 404)
    data = resp.get_json()
    assert 'downloadUrl' in data or 'error' in data


def test_get_datasets_details(client, first_dataset):
    uuid = first_dataset['uuid']
    wms_url = first_dataset.get('wmsUrl', {}).get('wms_url')
    datasets = [{'uuid': uuid, 'wmsServiceUrl': wms_url}]
    resp = client.post('/api/get-datasets-details', json={'datasets': datasets})
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, dict)
    assert uuid in data


def test_wms_info(client, first_dataset):
    wms_url = first_dataset.get('wmsUrl', {}).get('wms_url')
    if not wms_url:
        pytest.skip("No WMS URL available; skipping wms-info test")
    resp = client.get('/api/wms-info', query_string={'url': wms_url})
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, dict)
    assert 'available_layers' in data or 'error' in data 