document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const status = $('theatreStatus'), results = $('theatreResults');
  const today = new Date();
  const localDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  $('showDate').value = localDate(today);
  $('showDate').min = localDate(today);
  const localTimestamp = () => {
    const d = new Date();
    return `${localDate(d)}T${[d.getHours(),d.getMinutes(),d.getSeconds()].map(n=>String(n).padStart(2,'0')).join(':')}.000`;
  };
  function element(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = String(text);
    return el;
  }
  function formatShowtime(value) {
    const match = String(value || '').match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!match) return String(value || '');
    const hour = Number(match[1]);
    if (hour > 23 || Number(match[2]) > 59) return String(value || '');
    return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? 'PM' : 'AM'}`;
  }
  function safeBookingUrl(slot) {
    // MovieGlu may supply a booking URL on the individual showing.
    // Never construct a ticket link or assume a cinema homepage sells this showing.
    const candidate = slot.booking_link || slot.booking_url || slot.bookingUrl || slot.ticket_url;
    if (typeof candidate !== 'string') return null;
    try {
      const url = new URL(candidate);
      return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
    } catch { return null; }
  }
  let browserLocation = null;
  for (const id of ['theatreCity', 'theatreState']) {
    $(id).addEventListener('input', () => { browserLocation = null; });
  }
  $('useLocation').addEventListener('click', () => {
    if (!navigator.geolocation) { status.textContent = 'Your browser does not support location. Enter a city and state instead.'; return; }
    status.textContent = 'Requesting location permission…';
    navigator.geolocation.getCurrentPosition(pos => {
      browserLocation = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      $('theatreCity').value = '';
      $('theatreState').value = '';
      status.textContent = 'Location ready. Click Find theatres.';
    }, () => { status.textContent = 'Location unavailable or denied. Enter a city and state instead.'; }, { timeout: 10000 });
  });
  $('searchShowtimes').addEventListener('click', async () => {
    const city = $('theatreCity').value.trim(), state = $('theatreState').value.trim();
    if (!browserLocation && (!city || !state)) { status.textContent = 'Enter a city and state or click Use my location.'; return; }
    results.replaceChildren(); $('theatreCount').textContent = '';
    status.textContent = 'Searching MovieGlu…'; $('searchShowtimes').disabled = true;
    try {
      let coordinates = browserLocation;
      if (!coordinates) {
        const locationResponse = await fetch('/api/theatres/geocode?' + new URLSearchParams({ city, state }));
        const locationData = await locationResponse.json();
        if (!locationResponse.ok) throw new Error(locationData.error || 'Location not found');
        coordinates = locationData;
      }
      const response = await fetch('/api/theatres/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: coordinates.latitude, longitude: coordinates.longitude, date: $('showDate').value, title: $('movieTitle').value.trim(), deviceDatetime: localTimestamp() })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Search failed');
      const cinemas = data.cinemas || [];
      $('theatreCount').textContent = `${cinemas.length} locations`;
      status.textContent = cinemas.length ? (data.territory === 'XX' ? 'Sandbox test data — not real showtimes.' : 'MovieGlu results') : (data.message || 'No results for this location, movie and date.');
      for (const cinema of cinemas) {
        const card = element('article', 'theatre-card');
        const top = element('div', 'theatre-card__top');
        const info = element('div');
        info.append(element('h3', '', cinema.cinema_name || 'Cinema'), element('p', '', [cinema.address, cinema.city, cinema.postcode].filter(Boolean).join(', ')));
        top.append(info, element('span', '', cinema.distance != null ? `${cinema.distance} mi` : ''));
        card.append(top);
        const showings = cinema.showings || {};
        const groups = Object.entries(showings);
        const times = element('div', 'showtimes');
        for (const [format, details] of groups) {
          if (!details || !Array.isArray(details.times)) continue;
          for (const slot of details.times) {
            const label = `${formatShowtime(slot.start_time)} ${format}`.trim();
            const bookingUrl = safeBookingUrl(slot);
            if (bookingUrl) {
              const link = element('a', 'movieglu-time movieglu-time--link', label);
              link.href = bookingUrl;
              link.target = '_blank';
              link.rel = 'noopener noreferrer';
              link.title = 'Open ticket booking in a new tab';
              times.append(link);
            } else {
              const time = element('span', 'movieglu-time', label);
              time.title = 'Ticket booking link unavailable';
              times.append(time);
            }
          }
        }
        if (times.childNodes.length) card.append(times);
        else card.append(element('p', 'movieglu-note', $('movieTitle').value.trim() ? 'No times listed for this cinema.' : 'Enter a movie title to see showtimes.'));
        results.append(card);
      }
    } catch (error) { status.textContent = error.message; }
    finally { $('searchShowtimes').disabled = false; }
  });
});
