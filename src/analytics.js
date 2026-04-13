const GTM_ID = 'GTM-KSRLPFZ9'

const GTM_SCRIPT_ID = 'pomodoro-gtm-script'
const GTM_IFRAME_ID = 'pomodoro-gtm-noscript'

const isGtmEnabled = GTM_ID !== 'GTM-XXXXXXX'

const pushToDataLayer = (payload) => {
  if (typeof window === 'undefined') {
    return
  }

  window.dataLayer = window.dataLayer || []
  window.dataLayer.push(payload)
}

export const initGtm = () => {
  if (!isGtmEnabled || typeof document === 'undefined' || typeof window === 'undefined') {
    return
  }

  if (!document.getElementById(GTM_SCRIPT_ID)) {
    pushToDataLayer({
      'gtm.start': Date.now(),
      event: 'gtm.js',
    })

    const script = document.createElement('script')
    script.id = GTM_SCRIPT_ID
    script.async = true
    script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`
    document.head.appendChild(script)
  }

  if (!document.getElementById(GTM_IFRAME_ID)) {
    const noscript = document.createElement('noscript')
    noscript.id = GTM_IFRAME_ID
    noscript.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(
      GTM_ID,
    )}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`
    document.body.prepend(noscript)
  }
}

export const trackEvent = (event, parameters = {}) => {
  if (!isGtmEnabled) {
    return
  }

  pushToDataLayer({
    event,
    ...parameters,
  })
}

export const trackPageView = () => {
  if (typeof window === 'undefined') {
    return
  }

  trackEvent('page_view', {
    page_title: document.title,
    page_location: window.location.href,
    page_path: window.location.pathname,
  })
}
