# Racines & Roses

Interactieve kaart van de Facebookgroep Racines & Roses (Nederlandstalige vrouwen in Frankrijk).

- De gegevens worden bij elk bezoek live opgehaald uit de Google My Maps-kaart van de groep. Nieuwe pins verschijnen dus vanzelf.
- In deze repo staat geen ledendata, alleen de code en de grenzen van de départements ([france-geojson](https://github.com/gregoiredavid/france-geojson)).
- Het groepswachtwoord staat als SHA-256-hash in `app.js` (`PASSWORD_HASH`).

Lokaal draaien: `python -m http.server` in deze map en open http://localhost:8000.
