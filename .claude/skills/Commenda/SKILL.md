---
name: Commenda skill
description: Una skill che deve commentare minuziosamente il codice in un formato specifico, crea file di documentazione e inserisce nei commenti il riferimento al paragrafo della documentazione
---

# Commenda

Ogni feature, change request (CR) e bug fix deve lasciare due tracce: un documento in `Docs/` e commenti nel codice che rimandano a quel documento. Applica questa skill ogni volta che sviluppi, modifichi o correggi codice.

## 1. Classifica il lavoro

Prima di scrivere, decidi di che tipo è la modifica:

| Tipo | Quando | Dove si documenta |
|------|--------|-------------------|
| **Feature** | Funzionalità nuova | Nuovo file `Docs/<NOMEFEATURE>_<AAAAMMGG>.md` |
| **CR** | Modifica richiesta a una feature esistente | Nuovo paragrafo `CR_<n>` nel file della feature corrispondente |
| **Bug** | Correzione di un difetto | Nuovo file in `Docs/bugs/` |

Se non è chiaro a quale feature appartiene una CR, cerca in `Docs/` il file che la descrive. Se non esiste, trattala come feature.

## 2. Documenti in `Docs/`

### Nome e data
- Feature: `Docs/<NOMEFEATURE>_<DATAULTIMAMODIFICA>.md`, con la data nel formato `AAAAMMGG` (es. `Docs/LOGIN_20261116.md`).
- Ogni volta che modifichi il documento, **rinomina il file** con la data di oggi e aggiorna i riferimenti nei commenti del codice.
- Bug: `Docs/bugs/<NOMEBUG>_<AAAAMMGG>.md`. La cartella `bugs` è lo storico delle correzioni: non cancellare mai i file vecchi.

### Struttura obbligatoria
Ogni documento contiene, in quest'ordine:
1. Titolo della feature.
2. **Indice** dei paragrafi, con link alle ancore.
3. Un paragrafo per la feature e uno per ciascuna CR (`CR_1`, `CR_2`, …).

Ogni paragrafo (feature, CR o bug) risponde a queste domande:
- **Cosa** è stato fatto.
- **Perché** è stato fatto (la motivazione, non una ripetizione del "cosa").
- Solo per i bug: **qual era il problema** (sintomo, causa, come si riproduceva).
- **Commit**: il riferimento Git (hash breve), se esiste. Se il commit non c'è ancora, scrivi "da definire" e completalo appena fatto.

### Modello di paragrafo
```markdown
## CR_2 - Limite di tentativi al login
- **Cosa**: dopo 5 tentativi falliti l'account è bloccato per 15 minuti.
- **Perché**: richiesta di sicurezza del cliente.
- **Commit**: a1b2c3d
```

## 3. Commenti nel codice

Commenta ogni blocco che aggiungi o modifichi. Ogni commento indica brevemente **cosa** si è fatto, **quando** (data `AAAAMMGG`) e rimanda al paragrafo del documento. Formato:

```
// [Commenda] <cosa è stato fatto> | <AAAAMMGG> | Doc: Docs/<FILE>.md#<paragrafo>
```

Esempio:
```ts
// [Commenda] Blocca l'account dopo 5 tentativi falliti | 20261116 | Doc: Docs/LOGIN_20261116.md#cr_2
```

Regole:
- Usa la sintassi di commento del linguaggio (`//`, `#`, `<!-- -->`, ...), con lo stesso prefisso `[Commenda]`.
- Il commento va sopra il blocco, non in fondo alla riga, e spiega l'intento, non traduce il codice riga per riga.
- Il riferimento deve puntare a un paragrafo che esiste davvero. Dopo ogni rinomina del documento, aggiorna i commenti.
- Il testo dei commenti è in italiano.

## 4. Casi limite

- **La cartella `Docs/` non esiste**: creala, insieme a `Docs/bugs/`, al primo documento.
- **Modifica a codice già commentato**: aggiorna il commento esistente (cosa, data, riferimento) invece di aggiungerne uno nuovo accanto.
- **Una modifica tocca più feature**: documenta ciascuna nel proprio file e fai riferimenti incrociati nei paragrafi.
- **Refactoring senza cambio di comportamento**: documentalo come CR della feature interessata.
- **Bug scoperto mentre sviluppi una feature**: file separato in `Docs/bugs/`, non un paragrafo della feature.
- **File generati o dipendenze** (`node_modules`, migrazioni auto-generate, lockfile): non commentarli.
- **Commit non ancora disponibile**: lascia "da definire" e segnalalo nel riepilogo finale.

## 5. Criteri di completamento

Il lavoro è finito solo quando:
- [ ] Esiste il documento giusto (feature, CR o bug) con indice, cosa e perché, più il problema per i bug.
- [ ] Il nome del file riporta la data di oggi.
- [ ] Ogni blocco nuovo o modificato ha il commento `[Commenda]` con data e riferimento valido.
- [ ] I riferimenti ai commit sono presenti, oppure segnati "da definire".
- [ ] Nessun riferimento nei commenti punta a un file o paragrafo inesistente.

Chiudi con un riepilogo breve: documenti creati o aggiornati, file di codice commentati, riferimenti "da definire" ancora aperti.
