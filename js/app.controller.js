import { utilService } from './services/util.service.js'
import { locService } from './services/loc.service.js'
import { mapService } from './services/map.service.js'

window.onload = onInit

let gCurrentMode = ''
let gCurrentGeo = null
let gCurrentLocId = null

// To make things easier in this project structure
// functions that are called from DOM are defined on a global app object
window.app = {
  onRemoveLoc,
  onUpdateLoc,
  onSelectLoc,
  onPanToUserPos,
  onSearchAddress,
  onCopyLoc,
  onShareLoc,
  onSetSortBy,
  onSetFilterBy,
  removeLoc,
  onCloseLocModal,
  onSaveLoc,
}

var gUserPos

function onInit() {
  getFilterByFromQueryParams()
  loadAndRenderLocs()
  mapService
    .initMap()
    .then(() => {
      // onPanToTokyo()
      mapService.addClickListener(onAddLoc)
    })
    .catch((err) => {
      console.error('OOPs:', err)
      flashMsg('Cannot init map')
    })
}

function renderLocs(locs) {
  const selectedLocId = getLocIdFromQueryParams()

  var strHTML = locs
    .map((loc) => {
      const className = loc.id === selectedLocId ? 'active' : ''
      return `
        <li class="loc ${className}" data-id="${loc.id}">
            <h4>  
                <span>${loc.name}</span>
                <span title="${loc.rate} stars">${'★'.repeat(loc.rate)}</span>
            </h4>
            <p class="muted">
                Created: ${utilService.elapsedTime(loc.createdAt)}
                ${loc.createdAt !== loc.updatedAt ? ` | Updated: ${utilService.elapsedTime(loc.updatedAt)}` : ''}
            </p>
            <p class="distance-from-user"></p>
            <div class="loc-btns">     
               <button title="Delete" onclick="app.onRemoveLoc('${loc.id}')">🗑️</button>
               <button title="Edit" onclick="app.onUpdateLoc('${loc.id}')">✏️</button>
               <button title="Select" onclick="app.onSelectLoc('${loc.id}')">🗺️</button>
            </div>     
        </li>`
    })
    .join('')

  const elLocList = document.querySelector('.loc-list')
  elLocList.innerHTML = strHTML || 'No locs to show'

  renderLocStats()
  onSetDistance(locs)

  if (selectedLocId) {
    const selectedLoc = locs.find((loc) => loc.id === selectedLocId)
    displayLoc(selectedLoc)
  }
  document.querySelector('.debug').innerText = JSON.stringify(locs, null, 2)
}

function removeLoc(locId) {
  locService
    .remove(locId)
    .then(() => {
      flashMsg('Location removed')
      unDisplayLoc()
      loadAndRenderLocs()
    })
    .catch((err) => {
      console.error('OOPs:', err)
      flashMsg('Cannot remove location')
    })
}

function onSearchAddress(ev) {
  ev.preventDefault()
  const el = document.querySelector('[name=address]')
  mapService
    .lookupAddressGeo(el.value)
    .then((geo) => {
      mapService.panTo(geo)
    })
    .catch((err) => {
      console.error('OOPs:', err)
      flashMsg('Cannot lookup address')
    })
}

function onAddLoc(geo) {
  const elModal = document.querySelector('.loc-modal')
  const elModalTitle = elModal.querySelector('.modal-title')
  const elLocName = elModal.querySelector('.loc-name')
  const elLocRate = elModal.querySelector('.loc-rate')

  elModalTitle.textContent = 'Add New Location'
  elLocName.value = geo.address || ''
  elLocRate.value = 3

  gCurrentMode = 'add'
  gCurrentGeo = geo

  elModal.showModal()
}

function loadAndRenderLocs() {
  locService
    .query()
    .then(renderLocs)
    .catch((err) => {
      console.error('OOPs:', err)
      flashMsg('Cannot load locations')
    })
}

function onPanToUserPos() {
  mapService
    .getUserPosition()
    .then((latLng) => {
      gUserPos = latLng
      mapService.panTo({ ...latLng, zoom: 15 })
      unDisplayLoc()
      loadAndRenderLocs()
      flashMsg(`You are at Latitude: ${latLng.lat} Longitude: ${latLng.lng}`)

    })
    .catch((err) => {
      console.error('OOPs:', err)
      flashMsg('Cannot get your position')
    })
}

function onUpdateLoc(locId) {
  const elModal = document.querySelector('.loc-modal')
  const elModalTitle = elModal.querySelector('.modal-title')
  const elLocName = elModal.querySelector('.loc-name')
  const elLocRate = elModal.querySelector('.loc-rate')

  locService.getById(locId).then((loc) => {
    elModalTitle.textContent = 'Edit Location'
    elLocName.value = loc.name
    elLocRate.value = loc.rate

    gCurrentMode = 'edit'
    gCurrentLocId = locId

    elModal.showModal()
  })
}

function onSaveLoc(ev) {
  ev.preventDefault()
  const elModal = document.querySelector('.loc-modal')
  const elLocName = elModal.querySelector('.loc-name')
  const elLocRate = elModal.querySelector('.loc-rate')

  const locName = elLocName.value.trim()
  const rate = +elLocRate.value

  if (!locName) return

  if (gCurrentMode === 'add') {
    // Adding new location
    const loc = { name: locName, rate, geo: gCurrentGeo }
    locService
      .save(loc)
      .then((savedLoc) => {
        flashMsg(`Added Location`)
        utilService.updateQueryParams({ locId: savedLoc.id })
        loadAndRenderLocs()
        elModal.close()
      })
      .catch((err) => {
        console.error('OOPs:', err)
        flashMsg('Cannot add location')
      })
  }
  if (gCurrentMode === 'edit') {
    // Updating existing location
    locService
      .getById(gCurrentLocId)
      .then((loc) => {
        const updatedLoc = { ...loc, name: locName, rate }
        return locService.save(updatedLoc)
      })
      .then((savedLoc) => {
        flashMsg(`Location updated: ${savedLoc.name}`)
        loadAndRenderLocs()
        elModal.close()
      })
      .catch((err) => {
        console.error('OOPs:', err)
        flashMsg('Cannot update location')
      })
  }
}

function onCloseLocModal() {
  const elModal = document.querySelector('.loc-modal')
  elModal.close()

  gCurrentMode = ''
  gCurrentGeo = null
  gCurrentLocId = null
}

function onSelectLoc(locId) {
  return locService
    .getById(locId)
    .then(displayLoc)
    .catch((err) => {
      console.error('OOPs:', err)
      flashMsg('Cannot display this location')
    })
}

function displayLoc(loc) {
  document.querySelector('.loc.active')?.classList?.remove('active')
  document.querySelector(`.loc[data-id="${loc.id}"]`).classList.add('active')

  mapService.panTo(loc.geo)
  mapService.setMarker(loc)

  const el = document.querySelector('.selected-loc')
  el.querySelector('.loc-name').innerText = loc.name
  el.querySelector('.loc-address').innerText = loc.geo.address
  el.querySelector('.loc-rate').innerHTML = '★'.repeat(loc.rate)
  el.querySelector('[name=loc-copier]').value = window.location
  el.classList.add('show')

  if (gUserPos) {
    const distance = utilService.getDistance(gUserPos, loc.geo)
    el.querySelector('.loc-distance').innerText = `Distance: ${distance}`
  }

  utilService.updateQueryParams({ locId: loc.id })
}

function unDisplayLoc() {
  utilService.updateQueryParams({ locId: '' })
  document.querySelector('.selected-loc').classList.remove('show')
  mapService.setMarker(null)
}

function onCopyLoc() {
  const elCopy = document.querySelector('[name=loc-copier]')
  elCopy.select()
  elCopy.setSelectionRange(0, 99999) // For mobile devices
  navigator.clipboard.writeText(elCopy.value)
  flashMsg('Link copied, ready to paste')
}

function onShareLoc() {
  const url = document.querySelector('[name=loc-copier]').value

  // title and text not respected by any app (e.g. whatsapp)
  const data = {
    title: 'Cool location',
    text: 'Check out this location',
    url,
  }
  navigator.share(data)
}

function flashMsg(msg) {
  const el = document.querySelector('.user-msg')
  el.innerText = msg
  el.classList.add('open')
  setTimeout(() => {
    el.classList.remove('open')
  }, 3000)
}

function getFilterByFromQueryParams() {
  const queryParams = new URLSearchParams(window.location.search)
  const txt = queryParams.get('txt') || ''
  const minRate = queryParams.get('minRate') || 0
  locService.setFilterBy({ txt, minRate })

  document.querySelector('input[name="filter-by-txt"]').value = txt
  document.querySelector('input[name="filter-by-rate"]').value = minRate
}

function getLocIdFromQueryParams() {
  const queryParams = new URLSearchParams(window.location.search)
  const locId = queryParams.get('locId')
  return locId
}

function onSetSortBy() {
  const prop = document.querySelector('.sort-by').value
  const isDesc = document.querySelector('.sort-desc').checked

  if (!prop) return

  const sortBy = {}
  sortBy[prop] = isDesc ? -1 : 1

  // Shorter Syntax:
  // const sortBy = {
  //     [prop] : (isDesc)? -1 : 1
  // }

  locService.setSortBy(sortBy)
  loadAndRenderLocs()
}

function onSetFilterBy({ txt, minRate }) {
  const filterBy = locService.setFilterBy({ txt, minRate: +minRate })
  utilService.updateQueryParams(filterBy)
  loadAndRenderLocs()
}

function renderLocStats() {
  locService.getLocCountByRateMap().then((stats) => {
    handleStats(stats, 'loc-stats-rate')
  })
  locService.getLocCountByUpdateMap().then((stats) => {
    handleStats(stats, 'loc-stats-time')
  })
}

function handleStats(stats, selector) {
  // stats = { low: 37, medium: 11, high: 100, total: 148 }
  // stats = { low: 5, medium: 5, high: 5, baba: 55, mama: 30, total: 100 }
  const labels = cleanStats(stats)
  const colors = utilService.getColors()

  var sumPercent = 0
  var colorsStr = `${colors[0]} ${0}%, `
  labels.forEach((label, idx) => {
    if (idx === labels.length - 1) return
    const count = stats[label]
    const percent = Math.round((count / stats.total) * 100, 2)
    sumPercent += percent
    colorsStr += `${colors[idx]} ${sumPercent}%, `
    if (idx < labels.length - 1) {
      colorsStr += `${colors[idx + 1]} ${sumPercent}%, `
    }
  })

  colorsStr += `${colors[labels.length - 1]} ${100}%`
  // Example:
  // colorsStr = `purple 0%, purple 33%, blue 33%, blue 67%, red 67%, red 100%`

  const elPie = document.querySelector(`.${selector} .pie`)
  const style = `background-image: conic-gradient(${colorsStr})`
  elPie.style = style

  const ledendHTML = labels
    .map((label, idx) => {
      return `
                <li>
                    <span class="pie-label" style="background-color:${colors[idx]}"></span>
                    ${label} (${stats[label]})
                </li>
            `
    })
    .join('')

  const elLegend = document.querySelector(`.${selector} .legend`)
  elLegend.innerHTML = ledendHTML
}

function cleanStats(stats) {
  const cleanedStats = Object.keys(stats).reduce((acc, label) => {
    if (label !== 'total' && stats[label]) {
      acc.push(label)
    }
    return acc
  }, [])
  return cleanedStats
}

function onRemoveLoc(locId) {
  const elRemoveModal = document.querySelector('.remove-confirmation-modal')
  elRemoveModal.showModal()
  const elYesBtn = document.querySelector('.remove-btn')
  const elNoBtn = document.querySelector('.cancel-btn')
  elYesBtn.addEventListener('click', () => {
    removeLoc(locId)
    elRemoveModal.close()
  })
  elNoBtn.addEventListener('click', () => elRemoveModal.close())
}


function onSetDistance(locs) {
  if (!gUserPos) return
  locs.forEach(loc => {
    const distances = utilService.getDistance(gUserPos, loc.geo)
    renderDistance(loc.id, distances)
})
}

function renderDistance(locId, disatance) {
  const elLoc = document.querySelector(`[data-id="${locId}"]`)
  const elLocDistance = elLoc.querySelector('.distance-from-user')
  elLocDistance.innerHTML = `Disatance: ${disatance}`

}