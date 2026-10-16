import overview1 from "@/assets/pricelists/overview-1.jpg";
import overview2 from "@/assets/pricelists/overview-2.jpg";
import single1 from "@/assets/pricelists/single-1.jpg";
import single2 from "@/assets/pricelists/single-2.jpg";
import denture1 from "@/assets/pricelists/denture-1.jpg";
import ao41 from "@/assets/pricelists/allon4-1.jpg";
import ao42 from "@/assets/pricelists/allon4-2.jpg";
import ao43 from "@/assets/pricelists/allon4-3.jpg";
import ao44 from "@/assets/pricelists/allon4-4.jpg";
import ao51 from "@/assets/pricelists/allon5-1.jpg";
import ao52 from "@/assets/pricelists/allon5-2.jpg";
import ao53 from "@/assets/pricelists/allon5-3.jpg";
import ao54 from "@/assets/pricelists/allon5-4.jpg";
import ao61 from "@/assets/pricelists/allon6-1.jpg";
import ao62 from "@/assets/pricelists/allon6-2.jpg";
import ao63 from "@/assets/pricelists/allon6-3.jpg";
import ao64 from "@/assets/pricelists/allon6-4.jpg";

export type PriceList = {
  id: string;
  title: string;
  description: string;
  pages: string[];
};

export const PRICE_LISTS: PriceList[] = [
  {
    id: "overview",
    title: "General price list",
    description: "Dental services at Dr. Care — overview",
    pages: [overview1, overview2],
  },
  {
    id: "single",
    title: "Single service price list",
    description: "Individual treatments, crowns and implants",
    pages: [single1, single2],
  },
  {
    id: "denture",
    title: "Removable denture price list",
    description: "Removable and partial dentures",
    pages: [denture1],
  },
  {
    id: "allon4",
    title: "Full arch — All-on-4",
    description: "Full-arch All-on-4 packages",
    pages: [ao41, ao42, ao43, ao44],
  },
  {
    id: "allon5",
    title: "Full arch — All-on-5",
    description: "Full-arch All-on-5 packages",
    pages: [ao51, ao52, ao53, ao54],
  },
  {
    id: "allon6",
    title: "Full arch — All-on-6",
    description: "Full-arch All-on-6 packages",
    pages: [ao61, ao62, ao63, ao64],
  },
];
