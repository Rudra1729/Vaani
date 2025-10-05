import React, { useState, useEffect, useRef } from "react";
import { Brain, FileText, Link, ChevronRight, ChevronDown, Loader2, AlertCircle } from "lucide-react";
import "./MindMap.css";

const MindMap = ({ pdfUrl }) => {
  const [mindMapData, setMindMapData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedNode, setSelectedNode] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  // Generate mind map data from research paper
  const generateMindMap = async () => {
    setLoading(true);
    setError("");
    
    try {
      // First check if PDF is loaded
      const testResponse = await fetch("http://127.0.0.1:5001/test-mindmap");
      const testData = await testResponse.json();
      
      if (!testData.pdf_exists) {
        setError("No PDF loaded. Please load a PDF first.");
        return;
      }
      
      console.log("PDF status:", testData);
      
      const response = await fetch("http://127.0.0.1:5001/generate-mindmap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pdfUrl }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Mind map response:", data);
      
      if (data.mindMap) {
        setMindMapData(data.mindMap);
        // Auto-expand the root node and first few children
        const initialExpanded = new Set([data.mindMap.id]);
        if (data.mindMap.children) {
          // Expand first 3-4 main nodes by default
          data.mindMap.children.slice(0, 4).forEach(child => {
            initialExpanded.add(child.id);
          });
        }
        setExpandedNodes(initialExpanded);
        console.log("Mind map generated successfully:", data.mindMap);
      } else if (data.error) {
        setError(data.error);
        console.error("Mind map error:", data.error);
      }
    } catch (error) {
      console.error("Error generating mind map:", error);
      setError(`Failed to generate mind map: ${error.message}. Please ensure the backend server is running and a PDF is loaded.`);
    } finally {
      setLoading(false);
    }
  };

  // Handle node click
  const handleNodeClick = (node) => {
    setSelectedNode(node);
    if (node.children && node.children.length > 0) {
      const newExpanded = new Set(expandedNodes);
      if (expandedNodes.has(node.id)) {
        newExpanded.delete(node.id);
      } else {
        newExpanded.add(node.id);
      }
      setExpandedNodes(newExpanded);
    }
  };

  // Handle zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(3, zoom * delta));
    setZoom(newZoom);
  };

  // Handle pan
  const handleMouseDown = (e) => {
    if (e.target.tagName === 'svg' || e.target.tagName === 'g') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Reset view
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Render connection between nodes
  const renderConnection = (fromNode, toNode, connectionType = "hierarchical") => {
    const fromX = fromNode.x || 0;
    const fromY = fromNode.y || 0;
    const toX = toNode.x || 0;
    const toY = toNode.y || 0;
    
    const fromRadius = Math.max(20, Math.min(60, 30 + fromNode.importance * 20));
    const toRadius = Math.max(20, Math.min(60, 30 + toNode.importance * 20));
    
    // Calculate connection points
    const dx = toX - fromX;
    const dy = toY - fromY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const unitX = dx / distance;
    const unitY = dy / distance;
    
    const startX = fromX + unitX * fromRadius;
    const startY = fromY + unitY * fromRadius;
    const endX = toX - unitX * toRadius;
    const endY = toY - unitY * toRadius;
    
    // Different line styles based on connection type
    const lineStyle = connectionType === "semantic" ? {
      stroke: "#8b5cf6",
      strokeWidth: 3,
      strokeDasharray: "5,5",
      opacity: 0.7
    } : {
      stroke: "#6b7280",
      strokeWidth: 2,
      strokeDasharray: "3,3",
      opacity: 0.8
    };
    
    return (
      <line
        key={`${fromNode.id}-${toNode.id}`}
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        className="mindmap-connection"
        style={lineStyle}
      />
    );
  };

  // Render node with index for proper positioning
  const renderNodeWithIndex = (node, level = 0, index = 0, parent = null) => {
    // Assign index and parent
    node.index = index;
    node.parent = parent;
    return renderNode(node, level, 0, 0);
  };

  // Render node
  const renderNode = (node, level = 0, parentX = 0, parentY = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedNode && selectedNode.id === node.id;
    
    const nodeRadius = Math.max(30, Math.min(90, 50 + node.importance * 25));
    
    // Better positioning for 9-10 nodes
    let x, y;
    if (level === 0) {
      // Root node at center
      x = node.x || 0;
      y = node.y || 0;
    } else {
      // Arrange children in a circle around the root
      const angle = (node.index || 0) * (2 * Math.PI / (node.parent?.children?.length || 1));
      const radius = 200 + level * 100;
      x = node.x || (Math.cos(angle) * radius);
      y = node.y || (Math.sin(angle) * radius);
    }
    
    // Update node position
    node.x = x;
    node.y = y;

    return (
      <g key={node.id} transform={`translate(${x}, ${y})`}>
        {/* Node circle with gradient */}
        <defs>
          <radialGradient id={`gradient-${node.id}`} cx="30%" cy="30%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
            <stop offset="100%" stopColor={node.color || "#6366f1"} />
          </radialGradient>
        </defs>
        
        <circle
          cx={0}
          cy={0}
          r={nodeRadius}
          fill={isSelected ? "#3b82f6" : `url(#gradient-${node.id})`}
          stroke={isSelected ? "#1d4ed8" : node.color || "#6366f1"}
          strokeWidth={isSelected ? 4 : 3}
          className="mindmap-node"
          onClick={() => handleNodeClick(node)}
          style={{ cursor: "pointer" }}
        />
        
        {/* Node text with better positioning */}
        <text
          x={0}
          y={0}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize={Math.max(12, Math.min(16, nodeRadius / 4))}
          fontWeight="bold"
          className="mindmap-node-text"
          onClick={() => handleNodeClick(node)}
          style={{ cursor: "pointer", textShadow: "1px 1px 2px rgba(0,0,0,0.5)" }}
        >
          {node.title}
        </text>

        {/* Expand/collapse indicator */}
        {hasChildren && (
          <g transform={`translate(${nodeRadius + 8}, 0)`}>
            <circle
              r={10}
              fill="rgba(255, 255, 255, 0.9)"
              stroke="#6b7280"
              strokeWidth={2}
              onClick={() => handleNodeClick(node)}
              style={{ cursor: "pointer" }}
            />
            {isExpanded ? (
              <ChevronDown size={14} x={-7} y={-7} fill="#6b7280" />
            ) : (
              <ChevronRight size={14} x={-7} y={-7} fill="#6b7280" />
            )}
          </g>
        )}

        {/* Enhanced bullet points cloud */}
        {isExpanded && node.bulletPoints && node.bulletPoints.length > 0 && (
          <g transform={`translate(${nodeRadius + 40}, 0)`}>
            <rect
              x={-15}
              y={-node.bulletPoints.length * 12 - 15}
              width={250}
              height={node.bulletPoints.length * 24 + 30}
              fill="rgba(255, 255, 255, 0.98)"
              stroke={node.color || "#6366f1"}
              strokeWidth={2}
              rx={12}
              className="mindmap-cloud"
              style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.15))" }}
            />
            <text
              x={0}
              y={-node.bulletPoints.length * 12 - 5}
              fontSize={13}
              fontWeight="bold"
              fill={node.color || "#6366f1"}
              textAnchor="middle"
              className="mindmap-cloud-title"
            >
              Key Points
            </text>
            {node.bulletPoints.map((point, index) => (
              <text
                key={index}
                x={0}
                y={index * 20 - node.bulletPoints.length * 12 + 10}
                fontSize={12}
                fill="#374151"
                textAnchor="middle"
                className="mindmap-bullet"
              >
                • {point}
              </text>
            ))}
          </g>
        )}

        {/* Render children with better positioning */}
        {isExpanded && node.children && node.children.map((child, index) => {
          return (
            <g key={child.id}>
              {/* Hierarchical connection line */}
              {renderConnection(node, child, "hierarchical")}
              {renderNodeWithIndex(child, level + 1, index, node)}
            </g>
          );
        })}
      </g>
    );
  };

  // Render semantic connections between related nodes
  const renderSemanticConnections = (mindMapData) => {
    if (!mindMapData || !mindMapData.children) return null;
    
    const connections = [];
    const allNodes = [];
    
    // Collect all nodes
    const collectNodes = (node) => {
      allNodes.push(node);
      if (node.children) {
        node.children.forEach(collectNodes);
      }
    };
    collectNodes(mindMapData);
    
    // Create connections based on node connections property
    allNodes.forEach(node => {
      if (node.connections) {
        node.connections.forEach(connectionId => {
          const targetNode = allNodes.find(n => n.id === connectionId);
          if (targetNode && targetNode !== node) {
            connections.push({ from: node, to: targetNode });
          }
        });
      }
    });
    
    return connections.map((connection, index) => 
      renderConnection(connection.from, connection.to, "semantic")
    );
  };

  // Auto-generate mind map on component mount
  useEffect(() => {
    if (pdfUrl) {
      generateMindMap();
    }
  }, [pdfUrl]);

  return (
    <div className="mindmap-container">
      <div className="mindmap-header">
        <div className="mindmap-title">
          <Brain size={24} />
          <h2>Research Paper Mind Map</h2>
        </div>
        <div className="mindmap-controls">
          <button
            onClick={resetView}
            className="mindmap-control-btn"
            title="Reset View"
          >
            Reset View
          </button>
          <button
            onClick={generateMindMap}
            className="mindmap-control-btn"
            disabled={loading}
            title="Regenerate Mind Map"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : "Regenerate"}
          </button>
          <button
            onClick={async () => {
              try {
                const response = await fetch("http://127.0.0.1:5001/test-mindmap");
                const data = await response.json();
                console.log("Debug info:", data);
                alert(`PDF Status: ${data.pdf_exists ? 'Loaded' : 'Not loaded'}\nPath: ${data.pdf_path || 'None'}`);
              } catch (e) {
                alert(`Debug failed: ${e.message}`);
              }
            }}
            className="mindmap-control-btn"
            title="Debug PDF Status"
          >
            Debug
          </button>
        </div>
      </div>

      <div className="mindmap-content">
        {loading && (
          <div className="mindmap-loading">
            <Loader2 size={48} className="loading-spinner" />
            <h3>Generating Mind Map</h3>
            <p>Analyzing research paper structure...</p>
          </div>
        )}

        {error && (
          <div className="mindmap-error">
            <AlertCircle size={48} />
            <h3>Error Generating Mind Map</h3>
            <p>{error}</p>
            <button onClick={generateMindMap} className="retry-btn">
              Try Again
            </button>
          </div>
        )}

        {mindMapData && !loading && (
          <div className="mindmap-visualization">
            <div
              ref={containerRef}
              className="mindmap-svg-container"
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <svg
                ref={svgRef}
                width="100%"
                height="100%"
                viewBox="0 0 1200 800"
                className="mindmap-svg"
              >
                <defs>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge> 
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                
                <g
                  transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
                  className="mindmap-graph"
                >
                  {/* Render semantic connections first (behind nodes) */}
                  {renderSemanticConnections(mindMapData)}
                  {/* Render nodes with proper indexing */}
                  {renderNodeWithIndex(mindMapData, 0)}
                </g>
              </svg>
            </div>

            {/* Node details panel */}
            {selectedNode && (
              <div className="mindmap-details">
                <h3>{selectedNode.title}</h3>
                <p className="mindmap-description">{selectedNode.description}</p>
                {selectedNode.keyPoints && selectedNode.keyPoints.length > 0 && (
                  <div className="mindmap-keypoints">
                    <h4>Key Points:</h4>
                    <ul>
                      {selectedNode.keyPoints.map((point, index) => (
                        <li key={index}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {selectedNode.connections && selectedNode.connections.length > 0 && (
                  <div className="mindmap-connections">
                    <h4>Related Concepts:</h4>
                    <div className="connection-tags">
                      {selectedNode.connections.map((connection, index) => (
                        <span key={index} className="connection-tag">
                          {connection}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!mindMapData && !loading && !error && (
          <div className="mindmap-empty">
            <Brain size={64} className="mindmap-empty-icon" />
            <h3>No Mind Map Available</h3>
            <p>Generate a mind map to visualize the research paper structure and concepts.</p>
            <button onClick={generateMindMap} className="generate-btn">
              Generate Mind Map
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MindMap;
