import ImagesPage from "../../page";
export default async function CaseImages({params}:{params:Promise<{area:string;caseId:string}>}){const {area,caseId}=await params;return ImagesPage({searchParams:Promise.resolve({area,case:caseId})});}
