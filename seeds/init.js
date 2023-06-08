if (process.env.NODE_ENV !== 'production') require('dotenv').config()
const fs = require('fs')
const xml_path = process.env.XML_PATH
const parsed_path = process.env.PARSED_PATH

function camelToSnake(string) {
  return string
    .replace(/[\w]([A-Z])/g, function (m) {
      return m[0] + '_' + m[1]
    })
    .toLowerCase()
}

exports.seed = function (knex) {
  let systems = fs.readFileSync(
    parsed_path + '/systems.json',
    'utf8'
  )
  systems = JSON.parse(systems).systems
  let components = fs.readFileSync(
      parsed_path + '/components.json',
    'utf16le'
  )
  components = JSON.parse(components)

  // Deletes ALL existing entries
  return knex('components')
    .del()
    .then(function () {
      return knex('systems')
        .del()
        .then(function () {
          return knex('roles').del()
            .then(function () {
              // Inserts seed entries
              return knex('roles')
              .insert([
                {id: 1, title: 'admin'},
              ])
              .then(function () {
                return knex('systems')
                  .insert(
                    systems.map((system) => {
                      let newSystem = {}
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
                  .then(() => {
                    let componentInserts = []
                    components.forEach((component) => {
                      let compSystems = JSON.parse(
                        JSON.stringify(component.SupportedSystems)
                      )

                      // Delete any keys we're not going to insert
                      delete component.SupportedSystems

                      let insertPayload = {}
                      Object.keys(component).forEach((key) => {
                        let newKey = key.charAt(0).toLowerCase() + key.slice(1)
                        if (key === 'LUCategory') {
                          newKey = 'luCategory'
                        }

                        insertPayload[camelToSnake(newKey)] = component[key]
                      })
                      componentInserts.push(
                        knex('components')
                          .insert(insertPayload)
                          .returning('id')
                          .then((comp) => {
                            comp = comp[0]
                            let compSystemsInsert = []
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
