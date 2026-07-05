# KRL Lines

Source of truth for line membership/topology is `src/lib/krl/topology.ts` (`LINES`).
This doc is the human-readable version, with station names next to their codes, in
the order trains actually run. Keep both in sync when KAI Commuter changes a route.

## Bogor/Nambo (red)

Jakarta Kota (JAKK) – Jayakarta (JAY) – Mangga Besar (MGB) – Sawah Besar (SW) –
Juanda (JUA) – Gondangdia (GDD) – Cikini (CKI) – Manggarai (MRI) – Tebet (TEB) –
Cawang (CW) – Duren Kalibata (DRN) – Pasar Minggu Baru (PSMB) – Pasar Minggu (PSM) –
Tanjung Barat (TNT) – Lenteng Agung (LNA) – Universitas Pancasila (UP) –
Universitas Indonesia (UI) – Pondok Cina (POC) – Depok Baru (DPB) – Depok (DP) –
Citayam (CTA) – fork:

- **Bogor branch:** Citayam (CTA) – Bojong Gede (BJD) – Cilebut (CLT) – Bogor (BOO)
- **Nambo branch:** Citayam (CTA) – Cibinong (CBN) – Nambo (NMO)

## Rangkasbitung (green)

Tanah Abang (THB) – Palmerah (PLM) – Kebayoran (KBY) – Pondok Ranji (PDJ) –
Jurang Mangu (JMU) – Sudimara (SDM) – Rawa Buntu (RU) – Serpong (SRP) –
Cisauk (CSK) – Cicayur (CC) – Parung Panjang (PRP) – Cilejit (CJT) – Daru (DAR) –
Tenjo (TEJ) – Tigaraksa (TGS) – Cikoya (CKY) – Maja (MJ) – Citeras (CTR) –
Rangkasbitung (RK)

## Lokal Merak (dark green)

Continues past Rangkasbitung; shares only the Rangkasbitung (RK) station with
the Rangkasbitung line above (see `LINE_EDGE_OVERRIDES` in topology.ts).

Rangkasbitung (RK) – Jambu Baru (JBU) – Catang (CT) – Cikeusal (CKL) –
Walantaka (WLT) – Serang (SG) – Karangantu (KRA) – Tonjong Baru (TOJB) –
Cilegon (CLG) – Krenceng (KEN) – Merak (MER)

## Tanjung Priok (pink)

Jakarta Kota (JAKK) – Kampung Bandan (KPB) – Ancol (AC) – Tanjung Priok (TPK)

## Tangerang (brown)

Duri (DU) – Grogol (GGL) – Pesing (PSG) – Taman Kota (TKO) – Bojong Indah (BOI) –
Rawa Buaya (RW) – Kalideres (KDS) – Poris (PI) – Batu Ceper (BPR) –
Tanah Tinggi (THI) – Tangerang (TNG)

## Cikarang Loop Line (blue)

Modeled in `topology.ts` as a single path (Cikarang out to Kampung Bandan, then
the shared loop segment back toward Jatinegara) rather than as four separate
named patterns, since that's all the routing/transfer logic needs. The full set of
real-world loop patterns run by KAI Commuter:

- **Full Racket A:** Cikarang (CKR) – Metland Telagamurni (TLM) – Cibitung (CIT) –
  Tambun (TB) – Bekasi Timur (BKST) – Bekasi (BKS) – Kranji (KRI) – Cakung (CUK) –
  Klender Baru (KLDB) – Buaran (BUA) – Klender (KLD) – Jatinegara (JNG) –
  Matraman (MTR) – Manggarai (MRI) – Sudirman (SUD) – Karet (KAT) –
  Tanah Abang (THB) – Duri (DU) – Angke (AK) – Kampung Bandan (KPB) –
  Rajawali (RJW) – Kemayoran (KMO) – Pasar Senen (PSE) – Gang Sentiong (GST) –
  Kramat (KMT) – Pondok Jati (POK) – Jatinegara (JNG) – ... back to Cikarang
- **Full Racket B:** same stations, reversed direction around the loop (via
  Manggarai/Sudirman first from Kampung Bandan side, then Jatinegara).
- **Half Racket A/B:** Cikarang (CKR) to Kampung Bandan (KPB) only, via the
  Manggarai side, in each direction, with no loop closure past Kampung Bandan.

