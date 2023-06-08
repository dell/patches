const getXMLS = () => {
	let xml_query = knex("xml_files")
			.select(
					"id",
					"file_name",
					"created_at"
			);
	return xml_query;
}

module.exports = (app) => {
	app.get("/api/xml_files", (req, res) => {
		getXMLS()
				.then((xml_files) => {
					res.send(
							{
								id: 'root',
								file_name: 'All XML Catalog Files',
								xml_files,
							}
					);
				})
				.catch((err) => {
					res.send({ error: err });
				});
	});
};