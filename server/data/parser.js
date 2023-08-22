if (process.env.NODE_ENV !== 'production') require('dotenv').config()
const express = require('express')
const path = require('path')
const fs = require('fs')
const xml2js = require('xml2js')
const app = express()
const http = require('http').Server(app)
const bodyParser = require('body-parser')
const logger = require('../logger');

app.use(bodyParser.json())

let catalog = {}
const parser = new xml2js.Parser()
fs.readFile(`${__dirname}/832021_1.00_Catalog.xml`, 'utf8', (err, data) => {
  parser.parseString(data, (err, result) => {
    catalog = result
  })
})

let temp = {}
const flatObject = function(source, target) {
  Object.keys(source).forEach(key => {
    if (source[key] !== null && Array.isArray(source[key])) {
      if (source[key].length === 1) {
        flatObject(source[key][0], target)
        target[key] = temp
        return
      } else {
        source[key].forEach(k => {
          flatObject(k, target)
        })
        target[key] = temp
      }
    } 
    if (source[key] !== null && source[key] instanceof Object) {
      flatObject(source[key], target)
      return
    } else {
      temp[key] = source[key]
      return
    }
  })
}

let z = {}
const flatten = function(source, target) {
  Object.keys(source).forEach(key => {
    if (source[key] !== null && source[key] instanceof Object && (source[key].hasOwnProperty('$') || key === '$')) {
      flatten(source[key], target)
      if (key !== '$') {
        let tmp = {}
        tmp[key] = z
        target[key] = z
      }
      return
    } 
    if (source[key] !== null && Array.isArray(source[key])) {
      let x = {}
      x[key] = source[key]
      flatObject(x, z)
      return
    } 
    z[key] = source[key]
  })
}

app.get('/api/systems', (req, res) => {
  if (!catalog.Manifest) return res.send({ error: 'Catalog not parsed yet' })
  let systems = {}
  catalog.Manifest.SoftwareComponent.forEach(comp => {
    logger.info(`Support systems are ${comp.SupportedSystems[0]}`)
    comp.SupportedSystems[0].Brand.forEach(b => {
      let brandName = b.Display[0]._
      b.Model.forEach(model => {
        model.$.brand = brandName
        model.Display = model.Display[0]._
        systems[model.$.systemID] = model
      })
    })
  })
  let output = {}
  temp = {} 
  flatObject(systems, output)
  res.send({ systems: Object.keys(output).map(d => output[d]) })
})

app.get('/api/devices', (req, res) => {
  if (!catalog.Manifest) return res.send({ error: 'Catalog not parsed yet' })
  let devices = {}
  let components = catalog.Manifest.SoftwareComponent
  components.forEach(comp => {
    comp.SupportedDevices[0].Device.forEach(d => {
      d.Display = d['Display'][0]._
      if (d.PCIInfo) {
        d.PCIInfo = d.PCIInfo[0].$
      }
      devices[d['$'].componentID] = d
    })
  })
  let output = {}
  temp = {}
  flatObject(devices, output)
  res.send({ devices: Object.keys(output).map(d => output[d]) })
})

app.get('/api/components', (req, res) => {
  if (!catalog.Manifest) return res.send({ error: 'Catalog not parsed yet' })
  let components = catalog.Manifest.SoftwareComponent
  components.forEach(comp => {
    comp.Name = comp.Name[0].Display[0]._
    comp.containerPowerCycleRequired = comp.$.containerPowerCycleRequired
    comp.dateTime = comp.$.dateTime
    comp.dellVersion = comp.$.dellVersion
    comp.hashMD5 = comp.$.hashMD5
    comp.packageID = comp.$.packageID
    comp.packageType = comp.$.packageType
    comp.path = comp.$.path
    comp.rebootRequired = comp.$.rebootRequired
    comp.releaseDate = comp.$.releaseDate
    comp.releaseID = comp.$.releaseID
    comp.schemaVersion = comp.$.schemaVersion
    comp.size = comp.$.size
    comp.vendorVersion = comp.$.vendorVersion
    delete comp.$
    comp.ComponentType = comp.ComponentType[0].$.value
    comp.Description = comp.Description[0].Display[0]._
    comp.LUCategory= comp.LUCategory[0].$.value
    comp.Category= comp.Category[0].$.value
    if (comp.hasOwnProperty('RevisionHistory')) {
      comp.RevisionHistory = comp.RevisionHistory[0].Display[0]._
    }
    comp.ImportantInfo= comp.ImportantInfo[0].$.URL
    delete comp.Criticality
    comp.SupportedDevices[0].Device.forEach(dev => {
      dev.componentID = dev.$.componentID
      dev.embedded = dev.$.embedded
      if (dev.hasOwnProperty('PCIInfo')) {
        dev.PCIInfo.forEach(info => {
          logger.info(info)
          info.deviceID = info.$.deviceID
          info.subDeviceID = info.$.subDeviceID
          info.subVendorID = info.$.subVendorID
          info.vendorID = info.$.vendorID
          delete info.$
        })
      }
      delete dev.$
      dev.Display = dev.Display[0]._
    })
    delete comp.SupportedSystems
    if(comp.hasOwnProperty('SupportedOperatingSystems')){
      delete comp.SupportedOperatingSystems
    }
  })
  res.send({ components })
})

app.get('/api/bundles', (req, res) => {
  if (!catalog.Manifest) return res.send({ error: 'Catalog not parsed yet' })
  let bundles = catalog.Manifest.SoftwareBundle
  bundles.forEach(bundle => {
    bundle.Name = bundle.Name[0].Display[0]._
    bundle.ComponentType[0].Display = bundle.ComponentType[0].Display[0]._
    bundle.Description = bundle.Description[0].Display[0]._
    bundle.Category[0].Display = bundle.Category[0].Display[0]._
    if (bundle.hasOwnProperty('TargetOSes')) {
      bundle.TargetOSes[0].OperatingSystem[0].Display = bundle.TargetOSes[0].OperatingSystem[0].Display[0]._
    }
    bundle.TargetSystems[0].Brand[0].Display = bundle.TargetSystems[0].Brand[0].Display[0]._
    bundle.TargetSystems[0].Brand[0].Model[0].Display = bundle.TargetSystems[0].Brand[0].Model[0].Display[0]._
    bundle.ImportantInfo[0].Display = bundle.ImportantInfo[0].Display[0]._
    let packages = []
    bundle.Contents[0].Package.forEach(package => {
      let p = {}
      p.path = package.$.path
      packages.push(p)
    })
    bundle.Contents[0].Package = packages
  })
  res.send({ bundles })
})

app.use(express.static(path.resolve(__dirname, '..', 'build')))
app.get('*', (req, res, next) => {
  res.sendFile(path.resolve(__dirname, '..', 'build', 'index.html'))
})

const PORT = process.env.PORT || 9000
http.listen(PORT, () => {
  logger.info(`App listening on port ${PORT}!`)
})
