import {
  ChevronDown,
  ChevronUp,
  Ghost,
  Loader2,
  RotateCw,
  Search,
} from "lucide-react";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { useToast } from "./ui-component/Use-toast";
import { useResizeDetector } from "react-resize-detector";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "./ui-component/Button";
import { Input } from "./ui-component/Input";
import { cn } from "../lib/utils";
import { ScrollArea } from "./ui-component/Scroll-Area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui-component/DropDown";
import PdfFullSecreen from "./Pdf-fullScreen";

// pdfjs.GlobalWorkerOptions.workerSrc = new URL(
// 	'pdfjs-dist/build/pdf.worker.min.mjs',
// 	import.meta.url,
// ).toString();

interface pdfRendererProps {
  url: string;
}

const PdfRender = ({ url }: pdfRendererProps) => {
  // pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;

  console.log("url",url)

  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const { toast } = useToast();
  const { width, ref } = useResizeDetector();
  const [numPages, setnumPages] = useState<number>();
  const [currPage, setcurrPage] = useState<number>(1);
  const [scale, setscale] = useState<number>(1);
  const [rotation, setrotation] = useState<number>(0);
  const [rederedScale, setrederedScale] = useState<number | null>(null);
  // const [isLoading, setIsLoading] = useState<boolean>(false);

  const isLoading = rederedScale !== scale;

  const customePageValidator = z.object({
    page: z
      .string()
      .refine((num) => Number(num) > 0 && Number(num) <= numPages!),
  });

  type TCustomePageValidator = z.infer<typeof customePageValidator>;

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<TCustomePageValidator>({
    defaultValues: {
      page: "1",
    },
    resolver: zodResolver(customePageValidator),
  });

  useEffect(() => {
    setrederedScale(null); 
    setTimeout(() => setrederedScale(scale), 100);
  }, [scale]);


  const handlePageSubmit = ({ page }: TCustomePageValidator) => {
    setcurrPage(Number(page));
    setValue("page", String(page));
  };

  return (
    <div className="w-full bg-white rounded-md shadow flex flex-col items-center">
      <div className="h-14 w-full border-b border-zinc-200 flex items-center justify-between px-2">
        <div className="flex items-center gap-1.5 ">
          <Button
            variant="ghost"
            aria-label="previous page"
            onClick={() => {
              setcurrPage((prev) => (prev - 1 > 1 ? prev - 1 : 1));
              setValue("page", String(currPage - 1));
            }}
            disabled={currPage <= 1}
          >
            <ChevronUp className="h-4 w-4  dark:text-black " />
          </Button>
          <div className="flex items-center gap-1.5">
            <Input
              {...register("page")}
              className={cn(
                "w-12 h-8",
                errors.page && "focus-visible:ring-red-500 "
              )}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSubmit(handlePageSubmit)();
                }
              }}
            />
            <span className="dark:text-black">/</span>
            <span className="dark:text-black">{numPages ?? "x"}</span>
          </div>
          <Button
            variant="ghost"
            aria-label="next page"
            onClick={() => {
              setcurrPage((prev) =>
                prev + 1 > numPages! ? numPages! : prev + 1
              );
              setValue("page", String(currPage + 1));
            }}
            disabled={numPages === undefined || currPage === numPages}
          >
            <ChevronDown className="h-4 w-4 dark:text-black" />
          </Button>
        </div>
        <div className="space-x-2 dark:text-black ">
          {/* <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="zoom"
                className="p-0.5 dark:text-black"
                variant="ghost"
              >
                <Search className="h-4 w-4  " />
                {scale * 100}%
                <ChevronDown className="h-3 w-3 opacity-50 " />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => setscale(1)}>
                100%
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setscale(1.5)}>
                150%
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setscale(2)}>
                200%
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setscale(2.5)}>
                250%
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu> */}

          <Button
            onClick={() => setrotation((prev) => prev + 90)}
            aria-label="rotate 90 degree"
            variant="ghost"
          >
            <RotateCw className="h-4 w-4" />
          </Button>

          <PdfFullSecreen fileUrl={url} />
        </div>
      </div>
      <div className="flex-1 w-full max-h-screen">
        <ScrollArea className="max-h-[calc(100vh-10rem)] overflow-y-scroll">
          <div ref={ref}>
            <Document
              file={url}
              className="max-h-full "
              loading={
                <div className="flex justify-center ">
                  <Loader2 className="my-24 h-6 w-6 animate-spin" />
                </div>
              }
              onLoadError={() => {
                toast({
                  title: "Error loading PDF",
                  description: "Please try again later",
                  variant: "destructive",
                });
              }}
              onLoadSuccess={({ numPages }: any) => {
                setnumPages(numPages);
              }}
            >
              <Page
                key={`@${currPage}-${scale}-${rotation}`}
                width={width || 1}
                pageNumber={currPage}
                scale={scale}
                rotate={rotation}
                // renderAnnotationLayer={false} 
                renderTextLayer={false} 
              />
            </Document>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default PdfRender;
