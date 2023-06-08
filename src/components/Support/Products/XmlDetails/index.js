import React, { useState, useEffect } from "react";
import http from "../../../http";
import XmlTreeComponents from "./VersionViewer";
import "./style.css";
import TreeView from "@mui/lab/TreeView";
import TreeItem from "@mui/lab/TreeItem";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

function XmlDetails() {
	const [expanded, setExpanded] = useState([]);
	const [selected, setSelected] = useState([]);
	const [data, setData] = useState([]);
	const [displayVersionViewerVisible, setDisplayVersionViewerVisible] = useState(false);
	const [active, setActive] = useState([]);

	useEffect(() => {
		return http.get(`/api/xml_files`).then((res) => {
			setData(res)
		});
	}, []);

	const openVersionViewer = (id) => e => {
		if(active.includes(id)){
			closeVersionViewer();
			setActive(active.filter((val, idx, arr) => {
				return val !== id;
			}));
			return;
		} else {
			active.push(id);
			setActive(active);
			setDisplayVersionViewerVisible(true);
		}
	}

	const closeVersionViewer = () => {
		setDisplayVersionViewerVisible(false);
	}

	/**
	 * TODO - Finish function documentation. https://github.com/orgs/dell/projects/7/views/1?pane=issue&itemId=29635215
	 * @param {*} node 
	 * @returns 
	 */
	const renderNodeLabel = node => {
			if (node.id !== 'root'){
				return (
					<span>
						{`Catalog: ${node.file_name}`}
					</span>
				);
			} else {
				return (
					<span>
						Current Catalog Files
					</span>
				);
			}
	}

	const renderLeafLabel = node => {
		return (
				<div>
					<span>
						{`XML version added on: ${node.created_at}`}
					</span>
					<br />
					<button className="component-dl" onClick={openVersionViewer(node.id)}>
						View driver versions in catalog
					</button>
					{active.includes(node.id) && <XmlTreeComponents xmlFileName={node.file_name}/>}
				</div>
		);
	}

	/**
	 * TODO - Finish function documentation. https://github.com/orgs/dell/projects/7/views/1?pane=issue&itemId=29635246 
	 * @param {*} nodes 
	 * @returns 
	 */
	const renderTree = (nodes) => (
		 <TreeItem nodeId={nodes.id} label={renderNodeLabel(nodes)}>
			 { Array.isArray(nodes.xml_files) ? nodes.xml_files.map((node) => renderTree(node)) : renderLeaf(nodes) }
		 </TreeItem>
	);

	const renderLeaf = (node) => {
		return (
				<TreeItem label={renderLeafLabel(node)}></TreeItem>
		);
	}

	// TODO - what is this aria-label="test" doing?
	// https://github.com/orgs/dell/projects/7/views/1?pane=issue&itemId=29635282
	return (
		<div className="container-fluid">
			<TreeView
					aria-label="test"
					defaultCollapseIcon={<ExpandMoreIcon/>}
					defaultExpanded={['root']}
					defaultExpandIcon={<ChevronRightIcon/>}
					/*sx={{
						height: 'auto',
						flexGrow: 1,
						maxWidth: 'auto',
						overflowY: 'auto',
					}}*/
			>
				{renderTree(data)}
			</TreeView>
		</div>
	);
}

export default XmlDetails;