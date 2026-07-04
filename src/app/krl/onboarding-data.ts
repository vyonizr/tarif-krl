import { IKRLRouteResult } from "@/lib/krl/types"
import { IFavoriteRoute } from "../types"

export const MOCK_ORIGIN_STATION_ID = "BOO"
export const MOCK_DEST_STATION_ID = "SRP"

export const MOCK_ROUTE_LEGS: IKRLRouteResult[] = [
  {
    train_id: "demo-bogor-1",
    train_name: "COMMUTER LINE BOGOR",
    color: "#e03a35",
    stops: [
      { station_id: "BOO", station_name: "Bogor", time_est: "07:00:00" },
      { station_id: "CLT", station_name: "Cilebut", time_est: "07:06:00" },
      { station_id: "BJD", station_name: "Bojonggede", time_est: "07:12:00" },
      { station_id: "CTA", station_name: "Citayam", time_est: "07:17:00" },
      { station_id: "DP", station_name: "Depok", time_est: "07:21:00" },
      { station_id: "DPB", station_name: "Depok Baru", time_est: "07:24:00" },
      { station_id: "POC", station_name: "Pondok Cina", time_est: "07:27:00" },
      {
        station_id: "UI",
        station_name: "Universitas Indonesia",
        time_est: "07:30:00",
      },
      {
        station_id: "UP",
        station_name: "Universitas Pancasila",
        time_est: "07:33:00",
      },
      {
        station_id: "LNA",
        station_name: "Lenteng Agung",
        time_est: "07:36:00",
      },
      {
        station_id: "TNT",
        station_name: "Tanjung Barat",
        time_est: "07:39:00",
      },
      {
        station_id: "PSM",
        station_name: "Pasar Minggu",
        time_est: "07:42:00",
      },
      {
        station_id: "PSMB",
        station_name: "Pasar Minggu Baru",
        time_est: "07:45:00",
      },
      {
        station_id: "DRN",
        station_name: "Duren Kalibata",
        time_est: "07:49:00",
      },
      { station_id: "CW", station_name: "Cawang", time_est: "07:53:00" },
      { station_id: "TEB", station_name: "Tebet", time_est: "07:57:00" },
      { station_id: "MRI", station_name: "Manggarai", time_est: "08:01:00" },
    ],
  },
  {
    train_id: "demo-cikarang-1",
    train_name: "COMMUTER LINE CIKARANG",
    color: "#2c6ec7",
    stops: [
      { station_id: "MRI", station_name: "Manggarai", time_est: "08:10:00" },
      { station_id: "SUD", station_name: "Sudirman", time_est: "08:13:00" },
      { station_id: "KAT", station_name: "Karet", time_est: "08:16:00" },
      { station_id: "THB", station_name: "Tanah Abang", time_est: "08:19:00" },
    ],
  },
  {
    train_id: "demo-rangkasbitung-1",
    train_name: "COMMUTER LINE RANGKASBITUNG",
    color: "#2b9348",
    stops: [
      { station_id: "THB", station_name: "Tanah Abang", time_est: "08:28:00" },
      { station_id: "PLM", station_name: "Palmerah", time_est: "08:31:00" },
      { station_id: "KBY", station_name: "Kebayoran", time_est: "08:35:00" },
      { station_id: "PDJ", station_name: "Pondok Ranji", time_est: "08:39:00" },
      {
        station_id: "JMU",
        station_name: "Jurangmangu",
        time_est: "08:42:00",
      },
      { station_id: "SDM", station_name: "Sudimara", time_est: "08:46:00" },
      { station_id: "RU", station_name: "Rawa Buntu", time_est: "08:50:00" },
      { station_id: "SRP", station_name: "Serpong", time_est: "08:54:00" },
    ],
  },
]

export const MOCK_FARE = 11000

export function createMockFavorites(): IFavoriteRoute[] {
  return [
    {
      originStationId: "JAKK",
      destinationStationId: "BOO",
      region: "jabodetabek",
      savedAt: Date.now(),
    },
    {
      originStationId: "THB",
      destinationStationId: "SRP",
      region: "jabodetabek",
      savedAt: Date.now(),
    },
  ]
}
