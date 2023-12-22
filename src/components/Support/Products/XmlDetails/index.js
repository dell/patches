import React, { useState, useEffect } from "react";
import http from "../../../http";
import XmlTreeComponents from "./VersionViewer";
import "./style.css";
import { TreeView } from '@mui/x-tree-view';
import { TreeItem } from '@mui/x-tree-view/TreeItem'
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { v4 as uuidv4 } from 'uuid';

function XmlDetails() {
	// A list of all the XML catalog files available in the database
	const [data, setData] = useState([]);

	// A list of which leaves are open
	const [active, setActive] = useState([]);

	useEffect(() => {
		const fetchData = async () => {
			const res = await http.get(`/api/xml_files`);
			setData(res);
		};
		fetchData();
	}, []);

	/**
	 * Handles the logic for opening and closing the version viewer.
	 * @param {string} id - The ID of the item being interacted with.
	 * @returns {Function} - The function to handle the opening and closing of the version viewer.
	 */
	const openVersionViewer = (id) => (e) => {
		// Check if the ID is already in the active array
		if (active.includes(id)) {
		// If the ID is already in the active array, remove it to close the version viewer
		setActive(active.filter((val) => val !== id));
		} else {
		// If the ID is not in the active array, add it to open the version viewer
		// Create a new array by spreading the existing values and adding the new ID
		setActive([...active, id]);
		}
	};	    

	/**
	 * Renders the label for each tree node.
	 * @param {Object} node - The node object. Ex: root or one of the XML files
	 * @returns {JSX.Element} - The rendered label JSX element.
	 */
	const renderNodeLabel = (node) => {
		if (node.id !== "root") {
			// If we're not at the root node that means we're iterating
			// over the xml files. Ex: Catalog: patches_2.00_Catalog.xml
			return <span>{`Catalog: ${node.file_name}`}</span>;
		} else {
			// If the current node is root that means we're at the top of the
			// tree and we need to render the top-level header
			return <span>Current Catalog Files</span>;
		}
	};

	/**
	 * Renders the label for each leaf node.
	 * @param {Object} node - The node object.
	 * @returns {JSX.Element} - The rendered label JSX element.
	 */
	const renderLeafLabel = (node) => {
		return (
			<div>
				<span>{`XML version added on: ${node.created_at}`}</span>
				<br />
				<button className="component-dl" onClick={openVersionViewer(node.id)}>
					View driver versions in catalog
				</button>
				{active.includes(node.id) && (
					<XmlTreeComponents xmlFileName={node.file_name} />
				)}
			</div>
		);
	};

	/**
	 * Renders the tree structure recursively.
	 * @param {Object} nodes - The node object representing the tree.
	 * @returns {JSX.Element} - The rendered tree JSX element.
	 */
	const renderTree = (nodes) => (
		<TreeItem key={uuidv4()} nodeId={nodes.id.toString()} label={renderNodeLabel(nodes)}>
			{Array.isArray(nodes.xml_files)
				? nodes.xml_files.map((node) => renderTree(node))
				: renderLeaf(nodes)}
		</TreeItem>
	);

	const renderLeaf = (node) => {
		// We aren't currently using the nodeId for anything but if it is not
		// provided Material will complain so we generate a random UUID. Setting
		// nodeId to node.id will cause the UI to become unresponsive
		return (
		  <TreeItem nodeId={uuidv4().toString()} key={node.id} label={renderLeafLabel(node)} />
		);
	};
	  
	return (
		<div className="container-fluid">
			{data.length === 0 ? (
				<p>Loading...</p>
			) : (
				<TreeView
					defaultCollapseIcon={<ExpandMoreIcon />}
					defaultExpanded={['root']}
					defaultExpandIcon={<ChevronRightIcon />}
				>
					{renderTree(data)}
				</TreeView>
			)}
		</div>
	);	
}

export default XmlDetails;
