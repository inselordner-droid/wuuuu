# WUUUU! – Sprich, und die Brücke steigt

**Credits:** Alle Grafiken stammen aus "Platformer Graphics (Deluxe)" von
Kenney Vleugels (kenney.nl), Lizenz CC0. Im Spiel steht das unter CREDITS,
erreichbar aus dem Hauptmenü und aus den Einstellungen.

Stimmgesteuertes Jump-'n'-Run mit zwei Spielarten. Die Grafik stammt jetzt
komplett aus **"Platformer Graphics (Deluxe)" von Kenney Vleugels**
(www.kenney.nl), Lizenz **CC0** – siehe `assets/KENNEY-LIZENZ.txt`.
Nutzung auch kommerziell erlaubt, Namensnennung willkommen, nicht Pflicht.

## Starten

Der Ordner gehört zusammen: `index.html`, `wuuu.js` und `assets/`.
Browser laden Bilder und geben das Mikrofon nur über einen Server frei:

```
cd wuuu
python3 -m http.server 8000
```

Dann `http://localhost:8000/` öffnen. Ein Doppelklick auf `index.html`
funktioniert nicht zuverlässig – die Bilder werden dann oft blockiert.

## Spielarten

- **Abenteuer** – 20 Level in fünf Umgebungen. Die Figur läuft durchgehend
  nach rechts; du steuerst nur die Höhe des Brückenwesens. Zwei goldene
  Marken zeigen, wo die Brücke bündig liegt. Passt sie nicht, fällt die Figur
  und startet am letzten Wegweiser neu.
- **Endlos** – vier Etagen, links und rechts je ein Häuschen pro Farbe, aber
  auf unterschiedlichen Etagen. Jede Figur startet in ihrem Häuschen und will
  zum gleichfarbigen Häuschen auf der anderen Seite. Setzt du sie auf der
  falschen Etage ab, läuft sie in ein fremdes Haus: ein Leben weg. Zehn Leben,
  ein Punkt pro richtiger Zuordnung. Am Ende gibst du euren Teamnamen ein, die
  besten zehn stehen im Hauptmenü unter RANGLISTE.
  Jede Runde spielt in einer anderen Welt: Grüne Hügel, Sandwüste, Lavagrotte,
  Schneeland, Burgmauern, Nachtsumpf – der Name wird zu Rundenbeginn kurz
  eingeblendet. Die Brücke muss nicht exakt bündig liegen: die Figuren springen
  bis 30 px hinauf und laufen bis 55 px hinunter.

Sterne hängen höher als die Überfahrt: wer sie will, hebt mitten in der Fahrt
an und muss unter den Deckenstacheln bleiben.

## Was sich mit den neuen Grafiken geändert hat

| | vorher | jetzt |
|---|---|---|
| Darstellung | selbst erzeugte Pixel-Art | Kenney-PNGs aus `assets/` |
| Auflösung | 480×270, harte Pixel | intern 1440×810, weich skaliert |
| Figuren | vier | **drei** (Kenney liefert drei Spielerfiguren) |
| Brückenwesen | blaues Pixelmonster | Kenney-Blockmonster, Gesicht wechselt mit der Lautstärke |
| Ziel | Haus | Tür mit wehender Fahne in der Farbe deiner Figur |
| Umgebungen | fünf | **sechs**: Gras, Sand, Stein, Schnee, Erde und Burg (Abenteuer nutzt fünf, Endlos alle sechs) |

Spielkoordinaten, Physik und alle 20 Level sind unverändert geblieben – nur
die Darstellung ist ausgetauscht.

## Bewegung und Physik

Die Figur läuft durchgehend und bleibt an keiner Kante stehen – auch die
Wesen im Endlos-Modus warten nicht mehr, sie laufen vor der Schachtkante auf
und ab, bis die Brücke passt.

Gemessene Werte: Ein Sprung ist 34 px hoch, dauert 0,75 s und trägt 46 px weit
(Wurfparabel aus Absprunggeschwindigkeit 240 px/s und Schwerkraft 780 px/s²).
Im Fall gilt eine Endgeschwindigkeit von 430 px/s. Das Brückenwesen ist schwer:
höchstens 260 px/s schnell, höchstens 700 px/s² Beschleunigung.

Trägheit ist sichtbar: Auf der steigenden Brücke lehnt sich die Figur um etwa
11° zurück; bleibt die Brücke stehen, kippt sie bis 17° nach vorn und hebt
kurz ab. Wer von einer steigenden Brücke läuft, nimmt deren Aufwärtsschwung
mit. Beim Landen staucht die Figur kurz, im Steigflug streckt sie sich.

## Schwierigkeitsgrade im Endlosmodus

| Grad | gleichzeitig sichtbar | Verhalten bei falscher Etage |
|---|---|---|
| Leicht | 3 | Figur läuft zum Schacht zurück, du kannst es noch einmal versuchen |
| Mittel | 4 | Figur läuft weiter – und damit ins falsche Haus |
| Schwer | 10 | wie Mittel, deutlich mehr Betrieb |
| Super schwer | 25 | wie Mittel, volles Gedränge |

Eine neue Figur erscheint erst, wenn wieder Platz ist – also sobald eine Figur
ihr Portal erreicht hat oder verloren ging. Zehn Leben gelten überall.

## Untergrund und Räumlichkeit

Randkacheln (`Left`/`Mid`/`Right`) sitzen nur noch in der obersten Reihe –
dort, wo die Figur läuft. Alles darunter ist deckende Füllung (`Center`), die
Felswand (`CliffLeft`/`CliffRight`) liegt als Auflage darüber. Grund: Kenneys
Cliff-Kacheln decken nur 85 % und sind unten fast leer; gestapelt entstanden
dadurch Löcher, durch die man den Himmel sah. Dünne, schwebende Plattformen
(Endlosmodus) nutzen jetzt die dafür gedachten `Half`-Kacheln. Jede Kachel
wird mit 0,4 Einheiten Überstand gezeichnet, damit bei der Skalierung keine
Fugen aufblitzen. Boden und Flüssigkeit reichen bis Welt-y 360, also weit
unter den Bildrand – bei tiefem Kamerastand scheint unten kein Himmel mehr
durch.

Zusätzlich steht auf jeder Plattform ein Teil der Pflanzen und Felsen **vor**
der Figur (dieselbe Ebene, aber nach ihr gezeichnet, etwas größer). Zusammen
mit den zwei Hintergrund- und der Vordergrundebene ergibt das vier Tiefen.

## Stacheln und Bildrand

Die Deckenstacheln hängen bis Welt-y 44 herab und sind jetzt überall tödlich:
alle Brücken fahren bis y 48 hoch, eine mitfahrende Figur ragt dann bis y 33
und damit in die Zacken. Getestet in allen 16 Leveln mit Stacheln – wer auf der
Brücke voll aufdreht, verliert die Figur dort.

Damit ändert sich die Lautstärkeskala: Die nötige Lautstärke hängt jetzt allein
an der Höhe der Kante – 210 braucht etwa 21 %, 190 etwa 31 %, 170 etwa 41 %,
150 etwa 51 %. Das ist einfacher zu lernen als vorher, wo dieselbe Kante je
nach Brücke unterschiedlich laut sein konnte. Sterne hängen 42 Einheiten über
der Überfahrt und bleiben sicher unter den Stacheln.

## Flüssigkeiten

Das obere Drittel der Kenney-Oberflächenkachel ist komplett durchsichtig –
das ist die Wellenlinie. Deshalb liegt die deckende Farbfläche jetzt erst
7,4 Einheiten unter der Oberkante, also im unteren Drittel dieser Kachel, und
ragt nie über die Wasser- bzw. Lavalinie hinaus. Die Farbe ist direkt aus der
Kachel gemittelt: Wasser #96e3ec, Lava #e46816. Zusätzliche Strömungslinien gibt es
nicht mehr; die Bewegung kommt allein vom Wippen der Oberflächenkachel.

Die einzeln am unteren Bildrand mitlaufenden Pflanzen sind entfernt – die
Tiefenwirkung tragen jetzt die beiden Hintergrundebenen und die Pflanzen, die
vor der Figur auf der Plattform stehen.

## Hintergrund und Strömung

Die Hügelketten im Hintergrund stehen jetzt auf einem eigenen Farbband, das
mit derselben Parallaxe wandert wie sie selbst und bis unter den Bildrand
reicht. Vorher lief das Band mit einem anderen Faktor als die Silhouetten –
sobald die Kamera nach oben schwenkte, klaffte darunter der Himmel und die
Hügel schienen zu schweben. Geprüft bei Kameraständen -50, 0 und +60.

Wasser und Lava fließen langsam zur Seite: die Kacheln wandern (Wasser
5 Einheiten/s, Lava 2,2), beschnitten auf die Grubenfläche, dazu das leichte
Wippen der Oberfläche.

## Grafik austauschen

Jede Datei in `assets/` lässt sich einzeln ersetzen, solange der Name gleich
bleibt. Die Liste aller verwendeten Namen steht im Quelltext unter `MANIFEST`.
Kachelgröße und Figurenhöhe stehen in `CONFIG.game.tile` (12 Spieleinheiten)
und `CONFIG.art.playerH` (17).

## Steuerung

Stimme ist die Hauptsteuerung. Ersatz: Finger halten oder Leertaste,
Pfeil hoch/runter stärker bzw. schwächer, R Neustart, ESC Pause, F1 Debug.

## Getestet

`WUUU.selfTest()` in der Konsole prüft, ob alle 95 Grafiken geladen sind,
dazu Figurensätze, Levelstruktur und den Endlos-Aufbau. Headless simuliert:
alle 20 Level sturzfrei und mit allen Sternen lösbar (9–26 s), alle drei
Figuren gleich, Endlos 90 Sekunden ohne Verlust (34 Gerettete). Zusätzlich
wurden alle 20 Level über je 12 Sekunden gespielt und dabei alle Zeichenaufrufe
protokolliert: keine ungültigen Werte, kein unbekanntes Bild, keine Grafik mit
Größe null oder außerhalb des Rahmens, jede Dekoration auf ihrer Bodenlinie,
kein Stern in der Stachelzone, keine Überlappung von Wasser und Boden.
Dekoration wird nicht mehr über Tür oder Wegweiser gesetzt. Gemessen wurde
außerdem: die Figur steht in 25 Sekunden Spiel 0,0 % der Bilder still, die
Endlos-Wesen ebenfalls 0,0 %.
