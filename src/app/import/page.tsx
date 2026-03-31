import { FxcrmImporter } from "@/components/features/importer/FxcrmImporter";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "数据导入 | FxCRM Tool",
};

export default function ImportPage() {
    return (
        <FxcrmImporter />
    );
}
