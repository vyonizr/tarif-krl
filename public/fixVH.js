function setViewHeight() {
  let vh = window.innerHeight * 0.01
  document.documentElement.style.setProperty('--vh', `${vh}px`)
}

setViewHeight()

window.addEventListener('resize', () => {
  setViewHeight()
})
