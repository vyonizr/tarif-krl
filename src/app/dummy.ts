const STATIONS = [
  {
    sta_id: 'WIL1',
    sta_name: 'AREA JABODETABEK',
    group_wil: 0,
    fg_enable: 0,
    stations: [
      {
        sta_id: 'AC',
        sta_name: 'ANCOL',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'AK',
        sta_name: 'ANGKE',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'BJD',
        sta_name: 'BOJONGGEDE',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'BKS',
        sta_name: 'BEKASI',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'BKST',
        sta_name: 'BEKASITIMUR',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'BOI',
        sta_name: 'BOJONGINDAH',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'BOO',
        sta_name: 'BOGOR',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'BPR',
        sta_name: 'BATUCEPER',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'BUA',
        sta_name: 'BUARAN',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'CBN',
        sta_name: 'CIBINONG',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'CC',
        sta_name: 'CICAYUR',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'CIT',
        sta_name: 'CIBITUNG',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'CJT',
        sta_name: 'CILEJIT',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'CKI',
        sta_name: 'CIKINI',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'CKR',
        sta_name: 'CIKARANG',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'CKY',
        sta_name: 'CIKOYA',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'CLT',
        sta_name: 'CILEBUT',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'CSK',
        sta_name: 'CISAUK',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'CTA',
        sta_name: 'CITAYAM',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'CTR',
        sta_name: 'CITERAS',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'CUK',
        sta_name: 'CAKUNG',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'CW',
        sta_name: 'CAWANG',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'DAR',
        sta_name: 'DARU',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'DP',
        sta_name: 'DEPOK',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'DPB',
        sta_name: 'DEPOKBARU',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'DRN',
        sta_name: 'DURENKALIBATA',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'DU',
        sta_name: 'DURI',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'GDD',
        sta_name: 'GONDANGDIA',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'GGL',
        sta_name: 'GROGOL',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'GST',
        sta_name: 'GANGSENTIONG',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'JAKK',
        sta_name: 'JAKARTAKOTA',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'JAY',
        sta_name: 'JAYAKARTA',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'JMU',
        sta_name: 'JURANGMANGU',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'JNG',
        sta_name: 'JATINEGARA',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'JUA',
        sta_name: 'JUANDA',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'KAT',
        sta_name: 'KARET',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'KBY',
        sta_name: 'KEBAYORAN',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'KDS',
        sta_name: 'KALIDERES',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'KLD',
        sta_name: 'KLENDER',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'KLDB',
        sta_name: 'KLENDERBARU',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'KMO',
        sta_name: 'KEMAYORAN',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'KMT',
        sta_name: 'KRAMAT',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'KPB',
        sta_name: 'KAMPUNGBANDAN',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'KRI',
        sta_name: 'KRANJI',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'LNA',
        sta_name: 'LENTENGAGUNG',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'MGB',
        sta_name: 'MANGGABESAR',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'MJ',
        sta_name: 'MAJA',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'MRI',
        sta_name: 'MANGGARAI',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'MTM',
        sta_name: 'M.TELAGAMURNI',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'NMO',
        sta_name: 'NAMBO',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'PDJ',
        sta_name: 'PONDOKRANJI',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'PI',
        sta_name: 'PORIS',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'PLM',
        sta_name: 'PALMERAH',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'POC',
        sta_name: 'PONDOKCINA',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'POK',
        sta_name: 'PONDOKJATI',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'PRP',
        sta_name: 'PARUNGPANJANG',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'PSE',
        sta_name: 'PASARSENEN',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'PSG',
        sta_name: 'PESING',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'PSM',
        sta_name: 'PASARMINGGU',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'PSMB',
        sta_name: 'PAS.MINGGUBARU',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'RJW',
        sta_name: 'RAJAWALI',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'RK',
        sta_name: 'RANGKASBITUNG',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'RU',
        sta_name: 'RAWABUNTU',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'RW',
        sta_name: 'RAWABUAYA',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'SDM',
        sta_name: 'SUDIMARA',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'SRP',
        sta_name: 'SERPONG',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'SUD',
        sta_name: 'SUDIRMAN',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'SW',
        sta_name: 'SAWAHBESAR',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'TB',
        sta_name: 'TAMBUN',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'TEB',
        sta_name: 'TEBET',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'TEJ',
        sta_name: 'TENJO',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'TGS',
        sta_name: 'TIGARAKSA',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'THB',
        sta_name: 'TANAHABANG',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'TKO',
        sta_name: 'TAMANKOTA',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'TNG',
        sta_name: 'TANGERANG',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'TNT',
        sta_name: 'TANJUNGBARAT',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'TPK',
        sta_name: 'TANJUNGPRIUK',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'TTI',
        sta_name: 'TANAHTINGGI',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'UI',
        sta_name: 'UNIV.INDONESIA',
        group_wil: 0,
        fg_enable: 1,
      },
      {
        sta_id: 'UP',
        sta_name: 'UNIV.PANCASILA',
        group_wil: 0,
        fg_enable: 1,
      },
    ],
  },
  {
    sta_id: 'WIL6',
    sta_name: 'AREA YOGYAKARTA',
    group_wil: 0,
    fg_enable: 0,
    stations: [
      {
        sta_id: 'BBN',
        sta_name: 'BRAMBANAN',
        group_wil: 6,
        fg_enable: 1,
      },
      {
        sta_id: 'CE',
        sta_name: 'CEPER',
        group_wil: 6,
        fg_enable: 1,
      },
      {
        sta_id: 'DL',
        sta_name: 'DELANGGU',
        group_wil: 6,
        fg_enable: 1,
      },
      {
        sta_id: 'GW',
        sta_name: 'GAWOK',
        group_wil: 6,
        fg_enable: 1,
      },
      {
        sta_id: 'JN',
        sta_name: 'JENAR',
        group_wil: 6,
        fg_enable: 1,
      },
      {
        sta_id: 'KT',
        sta_name: 'KLATEN',
        group_wil: 6,
        fg_enable: 1,
      },
      {
        sta_id: 'KTA',
        sta_name: 'KUTOARJO',
        group_wil: 6,
        fg_enable: 1,
      },
      {
        sta_id: 'LPN',
        sta_name: 'LEMPUYANGAN',
        group_wil: 6,
        fg_enable: 1,
      },
      {
        sta_id: 'MGW',
        sta_name: 'MAGUWO',
        group_wil: 6,
        fg_enable: 1,
      },
      {
        sta_id: 'PWS',
        sta_name: 'PURWOSARI',
        group_wil: 6,
        fg_enable: 1,
      },
      {
        sta_id: 'SLO',
        sta_name: 'SOLO BALAPAN',
        group_wil: 6,
        fg_enable: 1,
      },
      {
        sta_id: 'SWT',
        sta_name: 'SROWOT',
        group_wil: 6,
        fg_enable: 1,
      },
      {
        sta_id: 'WJ',
        sta_name: 'WOJO',
        group_wil: 6,
        fg_enable: 1,
      },
      {
        sta_id: 'WT',
        sta_name: 'WATES',
        group_wil: 6,
        fg_enable: 1,
      },
      {
        sta_id: 'YK',
        sta_name: 'YOGYAKARTA',
        group_wil: 6,
        fg_enable: 1,
      },
      {
        sta_id: 'PL',
        sta_name: 'PALUR',
        group_wil: 6,
        fg_enable: 1,
      },
      {
        sta_id: 'SK',
        sta_name: 'SOLO JEBRES',
        group_wil: 6,
        fg_enable: 1,
      },
    ],
  },
]

// suppose i have a station region code like this 'WIL6' or 'WIL1'. create a function to get the number only from the string. the number should be integer
function getRegionNumber(regionCode: string): number {
  return parseInt(regionCode.replace('WIL', ''))
}