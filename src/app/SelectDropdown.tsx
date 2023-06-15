// 'use client'

// interface SelectDropdownProps {
//   name: string
//   placeholder: string
//   onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
//   options: string[]
// }

// function SelectDropdown({
//   name,
//   placeholder,
//   onChange,
//   options,
// }: SelectDropdownProps) {
//   return (
//     <select
//       name='originStation'
//       onChange={(e) => {
//         setOriginStation(
//           stationList.find((station) => station.sta_id === e.target.value) ||
//             null
//         )
//       }}
//       className='w-[300px] py-2 px-4 bg-gray-100 rounded mt-4'
//     >
//       <option disabled selected className='py-2'>
//         Pilih Stasiun Asal
//       </option>
//       {options.map((station) => (
//         <option key={station.sta_id} value={station.sta_id} className='py-2'>
//           {convertToTitleCase(station.sta_name)}
//         </option>
//       ))}
//     </select>
//   )
// }

// export default SelectDropdown
