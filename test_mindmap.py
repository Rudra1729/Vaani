#!/usr/bin/env python3
"""
Test script for mind map generation
Run this to test if the mind map API is working correctly
"""

import requests
import json

def test_mindmap_api():
    base_url = "http://127.0.0.1:5001"
    
    print("🧠 Testing Mind Map API...")
    
    # Test 1: Check if server is running
    try:
        response = requests.get(f"{base_url}/health", timeout=5)
        print(f"✅ Server is running: {response.status_code}")
        health_data = response.json()
        print(f"   PDF loaded: {health_data.get('pdf_loaded', False)}")
        print(f"   Model loading: {health_data.get('model_loading', False)}")
    except Exception as e:
        print(f"❌ Server not running: {e}")
        return
    
    # Test 2: Check PDF status
    try:
        response = requests.get(f"{base_url}/test-mindmap", timeout=5)
        print(f"✅ PDF status check: {response.status_code}")
        test_data = response.json()
        print(f"   PDF path: {test_data.get('pdf_path', 'None')}")
        print(f"   PDF exists: {test_data.get('pdf_exists', False)}")
    except Exception as e:
        print(f"❌ PDF status check failed: {e}")
        return
    
    # Test 3: Generate mind map
    try:
        print("\n🔄 Generating mind map...")
        response = requests.post(
            f"{base_url}/generate-mindmap",
            json={"pdfUrl": "test"},
            timeout=30
        )
        print(f"✅ Mind map generation: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            mindmap = data.get('mindMap', {})
            print(f"   Root title: {mindmap.get('title', 'Unknown')}")
            print(f"   Children count: {len(mindmap.get('children', []))}")
            print(f"   First child: {mindmap.get('children', [{}])[0].get('title', 'None')}")
        else:
            error_data = response.json()
            print(f"❌ Error: {error_data.get('error', 'Unknown error')}")
            
    except Exception as e:
        print(f"❌ Mind map generation failed: {e}")

if __name__ == "__main__":
    test_mindmap_api()
