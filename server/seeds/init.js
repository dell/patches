if (process.env.NODE_ENV !== 'production') require('dotenv').config()
const fs = require('fs')
const xml_path = process.env.XML_PATH
const parsed_path = process.env.PARSED_PATH

/**
 * camelToSnake - Utility function for converting camel case to snake case
 * @param {string} inputString The string which you would like to convert to
 * snake case
 * @returns {string} The string as snake case
 */
function camelToSnake(string) {
  return string
    .replace(/[\w]([A-Z])/g, function (m) {
      return m[0] + '_' + m[1]
    })
    .toLowerCase()
}

/**
 * exports.seed - This is a generic Knex method used when there is no data in
 * the database. It allows you to load it with something before running. In our
 * case, it will look for parsed JSON files and load them in.
 * @param {Knex} knex - An instance of Knex.js. It provides the interface to run
 * database queries and migrations. More details can be found at the given TODO link.
 * @returns {Promise} - Returns a promise that resolves when all the seed data has been
 * inserted into the database. More information about the return value can be found at the given TODO link.
 */
exports.seed = function (knex) {

  // TODO - This file path appears incorrect and will likely not exist.
  // See https://github.com/orgs/dell/projects/7/views/1?pane=issue&itemId=29635115
  let systems = fs.readFileSync(
    parsed_path + '/systems.json',
    'utf8'
  )
  systems = JSON.parse(systems).systems
  let components = fs.readFileSync(
      parsed_path + '/components.json',
    'utf8'
  )
  components = JSON.parse(components)

  // Deletes ALL existing entries from the components, systems, and roles tables
  return knex('components')
  .del()
  .then(function () {
    return knex('systems')
      .del()
      .then(function () {
        return knex('roles').del()
          .then(function () {

            // Inserts the admin role into the roles table
            // This role is required for the application to function
            return knex('roles')
              .insert([
                {id: 1, title: 'admin'},
              ])

              // Inserts seed entries into the systems table
              // Each system is an object that represents a component's 
              // compatibility with a system
              .then(function () {
                return knex('systems')
                  .insert(
                    systems.map((system) => {
                      let newSystem = {}

                      // Maps each key of the system object to a new object 
                      // with transformed keys
                      Object.keys(system).forEach((systemKey) => {
                        switch (systemKey) {
                          case 'Display':
                            newSystem.name = system[systemKey]
                            break
                          default:
                            newSystem[camelToSnake(systemKey)] = system[systemKey]
                            break
                        }
                      })
                      return newSystem
                    })
                  )

                  // Inserts seed entries into the components table
                  // Each component is an object that represents a hardware 
                  // component
                  .then(() => {
                    let componentInserts = []

                    // Loops over each component object and inserts it into the
                    // components table
                    components.forEach((component) => {

                      // Extracts the SupportedSystems array from the component
                      // object
                      let compSystems = JSON.parse(
                        JSON.stringify(component.SupportedSystems)
                      )

                      // Deletes the SupportedSystems key from the component 
                      // object
                      delete component.SupportedSystems

                      // Maps each key of the component object to a new object
                      // with transformed keys
                      let insertPayload = {}
                      Object.keys(component).forEach((key) => {
                        let newKey = key.charAt(0).toLowerCase() + key.slice(1)
                        if (key === 'LUCategory') {
                          newKey = 'luCategory'
                        }
                        insertPayload[camelToSnake(newKey)] = component[key]
                      })

                      // Inserts the transformed component object into the 
                      // components table and returns the ID of the inserted
                      // component
                      componentInserts.push(
                        knex('components')
                          .insert(insertPayload)
                          .returning('id')
                          .then((comp) => {
                            comp = comp[0]
                            let compSystemsInsert = []

                            // Loops over the SupportedSystems array and 
                            // inserts each system/component pair into the
                            // component_systems table
                            compSystems.forEach((compSystem) => {
                              compSystemsInsert.push({
                                component_id: comp,
                                system_id: compSystem.systemID,
                              })
                            })
                            return knex('component_systems').insert(compSystemsInsert)
                          })
                      )
                    })
                    return Promise.all(componentInserts)
                  })
              })
          })
      })
  })
}