"use client"
import { useRef } from "react"
import { Joyride, ACTIONS, EVENTS, STATUS } from "react-joyride"
import type { Step, EventHandler } from "react-joyride"

interface KRLOnboardingTourProps {
  run: boolean
  onInjectMockData: () => void
  onTourEnd: () => void
}

const steps: Step[] = [
  {
    target: "#krl-page-header",
    content: (
      <div>
        <h3 className="mb-1 text-base font-semibold">Selamat Datang</h3>
        <p className="text-sm">
          Halaman ini membantu kamu mencari rute, jadwal, dan tarif KRL.
        </p>
      </div>
    ),
    placement: "bottom",
  },
  {
    target: "#krl-region-select",
    content: (
      <div>
        <h3 className="mb-1 text-base font-semibold">Area</h3>
        <p className="text-sm">
          Pilih area (untuk saat ini baru tersedia Jabodetabek) di sini.
        </p>
      </div>
    ),
    placement: "bottom",
  },
  {
    target: "#krl-origin-combobox",
    content: (
      <div>
        <h3 className="mb-1 text-base font-semibold">Stasiun Asal</h3>
        <p className="text-sm">Ketik atau pilih stasiun keberangkatan.</p>
      </div>
    ),
    placement: "bottom",
  },
  {
    target: "#krl-destination-combobox",
    content: (
      <div>
        <h3 className="mb-1 text-base font-semibold">Stasiun Tujuan</h3>
        <p className="text-sm">Lalu pilih stasiun tujuan.</p>
      </div>
    ),
    placement: "bottom",
  },
  {
    target: "#krl-swap-button",
    content: (
      <div>
        <h3 className="mb-1 text-base font-semibold">Tukar Stasiun</h3>
        <p className="text-sm">
          Tombol ini menukar posisi stasiun asal dan tujuan.
        </p>
      </div>
    ),
    placement: "bottom",
  },
  {
    target: "#krl-favorite-toggle",
    content: (
      <div>
        <h3 className="mb-1 text-base font-semibold">Favorit</h3>
        <p className="text-sm">
          Simpan pasangan stasiun ini sebagai favorit dengan ikon bintang.
        </p>
      </div>
    ),
    placement: "bottom",
  },
  {
    target: "#krl-time-select",
    content: (
      <div>
        <h3 className="mb-1 text-base font-semibold">Waktu Keberangkatan</h3>
        <p className="text-sm">
          Atur jam keberangkatan, atau biarkan di &apos;Sekarang&apos;.
        </p>
      </div>
    ),
    placement: "top",
  },
  {
    target: "#krl-route-result",
    content: (
      <div>
        <h3 className="mb-1 text-base font-semibold">Hasil Rute & Tarif</h3>
        <p className="text-sm">
          Begini hasilnya: rute lengkap dengan transit dan estimasi tarif.
        </p>
      </div>
    ),
    placement: "top",
  },
  {
    target: "#krl-favorites-bar",
    content: (
      <div>
        <h3 className="mb-1 text-base font-semibold">Bar Favorit</h3>
        <p className="text-sm">
          Rute yang kamu simpan akan muncul di sini untuk dipilih lagi dengan
          cepat.
        </p>
      </div>
    ),
    placement: "top",
  },
  {
    target: "#krl-page-header",
    content: (
      <div>
        <h3 className="mb-1 text-base font-semibold">Selesai</h3>
        <p className="text-sm">
          Sekarang kamu siap mencari rute KRL sendiri. Selamat mencoba!
        </p>
      </div>
    ),
    placement: "center",
  },
]

export default function KRLOnboardingTour({
  run,
  onInjectMockData,
  onTourEnd,
}: KRLOnboardingTourProps) {
  const tourEndedRef = useRef(false)
  const mockInjectedRef = useRef(false)

  const handleEvent: EventHandler = (data) => {
    if (
      data.type === EVENTS.STEP_BEFORE &&
      data.index >= 1 &&
      !mockInjectedRef.current
    ) {
      mockInjectedRef.current = true
      onInjectMockData()
    }

    if (
      (data.status === STATUS.FINISHED ||
        data.status === STATUS.SKIPPED ||
        data.action === ACTIONS.CLOSE) &&
      !tourEndedRef.current
    ) {
      tourEndedRef.current = true
      onTourEnd()
    }
  }

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      onEvent={handleEvent}
      options={{
        showProgress: true,
        skipBeacon: true,
        buttons: ["back", "close", "primary", "skip"],
        primaryColor: "#2c6ec7",
        zIndex: 10000,
      }}
      locale={{
        back: "Kembali",
        close: "Tutup",
        last: "Selesai",
        next: "Lanjut",
        skip: "Lewati",
      }}
    />
  )
}
