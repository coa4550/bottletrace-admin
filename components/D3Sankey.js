import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';

const D3Sankey = ({ data, width = 800, height = 600 }) => {
  const svgRef = useRef();

  useEffect(() => {
    if (!data || !data.nodes || !data.links) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll("*").remove();

    // Set up the SVG
    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    // Set up the Sankey generator with better spacing
    const sankeyGenerator = sankey()
      .nodeId(d => d.id)
      .nodeWidth(20)
      .nodePadding(20)
      .extent([[80, 20], [width - 80, height - 20]]);

    // Generate the Sankey layout
    const { nodes, links } = sankeyGenerator(data);

    // Color scale
    const color = d3.scaleOrdinal(d3.schemeCategory10);

    // Create the links
    const link = svg.append("g")
      .selectAll("path")
      .data(links)
      .enter().append("path")
      .attr("d", sankeyLinkHorizontal())
      .attr("stroke", "#000")
      .attr("stroke-opacity", 0.5)
      .style("fill", "none")
      .style("stroke-width", d => Math.max(1, d.width));

    // Add link tooltips
    link.append("title")
      .text(d => `${d.source.label} → ${d.target.label}`);

    // Create the nodes
    const node = svg.append("g")
      .selectAll("rect")
      .data(nodes)
      .enter().append("rect")
      .attr("x", d => d.x0)
      .attr("y", d => d.y0)
      .attr("height", d => d.y1 - d.y0)
      .attr("width", d => d.x1 - d.x0)
      .attr("fill", (d, i) => color(i))
      .attr("opacity", 0.8);

    // Add node tooltips
    node.append("title")
      .text(d => `${d.label} (Value: ${d.value || 0})`);

    // Create the labels with better positioning
    const label = svg.append("g")
      .selectAll("text")
      .data(nodes)
      .enter().append("text")
      .attr("x", d => d.x0 < width / 2 ? d.x1 + 12 : d.x0 - 12)
      .attr("y", d => (d.y1 + d.y0) / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end")
      .text(d => {
        // Truncate very long labels to prevent overlap
        const label = d.label;
        return label.length > 20 ? label.substring(0, 17) + '...' : label;
      })
      .style("font-size", "11px")
      .style("font-weight", "500")
      .style("fill", "#333")
      .style("pointer-events", "none")
      .style("text-shadow", "1px 1px 2px rgba(255,255,255,0.8)");

    // Add hover effects
    node
      .on("mouseover", function(event, d) {
        d3.select(this).attr("opacity", 1);
        // Highlight connected links
        link.attr("stroke-opacity", l => 
          l.source === d || l.target === d ? 1 : 0.1
        );
      })
      .on("mouseout", function(event, d) {
        d3.select(this).attr("opacity", 0.8);
        // Reset all links
        link.attr("stroke-opacity", 0.5);
      });

    link
      .on("mouseover", function(event, d) {
        d3.select(this).attr("stroke-opacity", 1);
      })
      .on("mouseout", function(event, d) {
        d3.select(this).attr("stroke-opacity", 0.5);
      });

  }, [data, width, height]);

  return (
    <div style={{ width: '100%', overflow: 'auto' }}>
      <svg ref={svgRef} style={{ display: 'block', margin: '0 auto' }} />
    </div>
  );
};

export default D3Sankey;
