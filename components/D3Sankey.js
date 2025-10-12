import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';

const D3Sankey = ({ data, width = 800, height = 600 }) => {
  const svgRef = useRef();

  useEffect(() => {
    if (!data || !data.nodes || !data.links) {
      console.log('D3Sankey: No data available', { data });
      return;
    }
    
    console.log('D3Sankey: Rendering with data', { 
      nodes: data.nodes.length, 
      links: data.links.length,
      sampleNode: data.nodes[0],
      sampleLink: data.links[0]
    });

    // Clear previous content
    d3.select(svgRef.current).selectAll("*").remove();

    // Set up the SVG
    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    // Set up the Sankey generator with fixed node width (d3-sankey doesn't support dynamic widths)
    const sankeyGenerator = sankey()
      .nodeId(d => d.id)
      .nodeWidth(25)
      .nodePadding(15)
      .extent([[100, 30], [width - 100, height - 30]]);

    // Generate the Sankey layout
    let nodes, links;
    try {
      const result = sankeyGenerator(data);
      nodes = result.nodes;
      links = result.links;
      console.log('D3Sankey: Generated layout', { 
        nodes: nodes.length, 
        links: links.length,
        sampleNode: nodes[0]
      });
    } catch (error) {
      console.error('D3Sankey: Error generating layout', error);
      return;
    }

    // Color scale with Monarch Money-style colors
    const color = d3.scaleOrdinal([
      '#3B82F6', // Blue
      '#10B981', // Green  
      '#F59E0B', // Orange
      '#EF4444', // Red
      '#8B5CF6', // Purple
      '#06B6D4', // Cyan
      '#F97316', // Orange
      '#84CC16', // Lime
      '#EC4899', // Pink
      '#6366F1', // Indigo
    ]);

    // Create the links with Monarch Money-style colors
    const link = svg.append("g")
      .selectAll("path")
      .data(links)
      .enter().append("path")
      .attr("d", sankeyLinkHorizontal())
      .attr("stroke", d => {
        // Use source node type for color
        if (d.source.type === 'distributor') return '#3B82F6';
        if (d.source.type === 'supplier') return '#10B981';
        if (d.source.type === 'brand') return '#F59E0B';
        return '#94A3B8';
      })
      .attr("stroke-opacity", 0.7)
      .style("fill", "none")
      .style("stroke-width", d => Math.max(1, d.width))
      .style("cursor", "pointer");

    // Add link tooltips
    link.append("title")
      .text(d => `${d.source.label} → ${d.target.label}`);

    // Create the nodes with type-based colors
    const node = svg.append("g")
      .selectAll("rect")
      .data(nodes)
      .enter().append("rect")
      .attr("x", d => d.x0)
      .attr("y", d => d.y0)
      .attr("height", d => d.y1 - d.y0)
      .attr("width", d => d.x1 - d.x0)
      .attr("fill", d => {
        // Color based on node type
        if (d.type === 'distributor') return '#3B82F6'; // Blue
        if (d.type === 'supplier') return '#10B981';   // Green
        if (d.type === 'brand') return '#F59E0B';      // Orange
        return color(nodes.indexOf(d));
      })
      .attr("opacity", 0.8)
      .style("cursor", "pointer")
      .style("stroke", "#fff")
      .style("stroke-width", 1);

    // Add node tooltips
    node.append("title")
      .text(d => `${d.label} (Value: ${d.value || 0})`);

    // Create the labels with Monarch Money-style positioning
    const label = svg.append("g")
      .selectAll("text")
      .data(nodes)
      .enter().append("text")
      .attr("x", d => d.x0 < width / 2 ? d.x1 + 16 : d.x0 - 16)
      .attr("y", d => (d.y1 + d.y0) / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end")
      .text(d => {
        // Truncate very long labels to prevent overlap
        const label = d.label;
        return label.length > 25 ? label.substring(0, 22) + '...' : label;
      })
      .style("font-size", "12px")
      .style("font-weight", "600")
      .style("fill", "#1F2937")
      .style("pointer-events", "none")
      .style("font-family", "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif");

    // Add Monarch Money-style hover effects
    node
      .on("mouseover", function(event, d) {
        d3.select(this)
          .attr("opacity", 1)
          .style("stroke-width", 2);
        // Highlight connected links
        link.attr("stroke-opacity", l => 
          l.source === d || l.target === d ? 0.9 : 0.3
        );
      })
      .on("mouseout", function(event, d) {
        d3.select(this)
          .attr("opacity", 0.8)
          .style("stroke-width", 1);
        // Reset all links
        link.attr("stroke-opacity", 0.7);
      });

    link
      .on("mouseover", function(event, d) {
        d3.select(this).attr("stroke-opacity", 0.9);
      })
      .on("mouseout", function(event, d) {
        d3.select(this).attr("stroke-opacity", 0.7);
      });

  }, [data, width, height]);

  return (
    <div style={{ width: '100%', overflow: 'auto' }}>
      <svg ref={svgRef} style={{ display: 'block', margin: '0 auto' }} />
    </div>
  );
};

export default D3Sankey;
