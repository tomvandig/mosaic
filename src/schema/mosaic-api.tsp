
import "@typespec/openapi3";
import "@typespec/http";

using Http;

@pattern("</(\\{{0,1}([0-9a-fA-F]){8}-([0-9a-fA-F]){4}-([0-9a-fA-F]){4}-([0-9a-fA-F]){4}-([0-9a-fA-F]){12}\\}{0,1})[0-9a-zA-Z\\/]+>")
scalar path extends string;

@pattern("</[A-Za-z0-9.]+:[A-Za-z0-9]+>")
scalar component_uri extends string;

@pattern("</[A-Za-z0-9.]+")
scalar component_file_name extends string;

@format("uuid")
scalar uuid extends string;

model TesseraStatus
{
  id: uuid;
  name: string;
  latestVersion: uuid;
}

model TesseraDetails
{
  id: uuid;
  name: string;
  history: TesseraVersion[]
}

model MosaicProvenanceData
{
  author: string;
  timestamp: string;
  application: string;
  message: string;
}

model TesseraVersion
{
  tesseraId: uuid;
  versionId: uuid;
  previousVersionId: uuid;
  provenance: MosaicProvenanceData;
}

model TesseraVersionMosaicFile
{
  blobUrl: string;
}

model CreateTesseraCommand
{
  id: uuid;
  name: string;
   ...Record<never>; // make additionalProperties = false show up
}

model UpdateTesseraCommand
{
  name: string;
}

model CreateTesseraVersionCommand
{
  id: uuid;
  previousTesseraVersionId: uuid;
  blobId: uuid;
}

model BlobResponse
{
  blobId: uuid;
  putURL: string;
}

enum MosaicFileDownloadType
{
  just_this_version,
  whole_tessera_history_intact,
  whole_tessera_history_condensed,
  whole_tessera_and_imports_history_condensed
}

enum CreateTesseraVersionResponseState
{
  OK,
  OUT_OF_DATE,
  VALIDATION_ERROR
}

model CreateTesseraVersionResponse
{
  state: CreateTesseraVersionResponseState;
  validationErrors: string[];
}

@service
@route("/Mosaic-api")
namespace MosaicApi {
    
  @route("/upload/{blobId}")
  @put op upload(@path blobId: uuid, @bodyRoot file: File): OkResponse;
  
  @route("/download/{blobId}")
  @put op download(@path blobId: uuid): File;
  
  @route("/tesserae")
  namespace Tesserae
  {
    @get op tesserae(): TesseraStatus[];

    @post op createTessera(@body cmd: CreateTesseraCommand): OkResponse;

    @route("/{tesseraId}")
    namespace TesseraRoutes {
      @get op get_tessera(@path tesseraId: uuid): TesseraDetails;
      @delete op delete_tessera(@path tesseraId: uuid): OkResponse;
      
      @route("/upload-Mosaic-blob-url")
      @post op uploadMosaicBlobUrl(@path tesseraId: uuid): BlobResponse;

      @route("/versions")
      namespace VersionsRoutes {
        @post op createTesseraVersion(@path tesseraId: uuid, @body version: CreateTesseraVersionCommand): CreateTesseraVersionResponse;

        @route("/{versionId}")
        namespace TesseraVersionRoutes
        {
          @get op get_tessera_version(@path tesseraId: uuid, @path versionId: uuid): TesseraVersion;

          @route("/download-Mosaic")
          @put op tessera_Mosaic(
            @path tesseraId: uuid, 
            @path versionId: uuid,
            @query downloadType: MosaicFileDownloadType
          ): TesseraVersionMosaicFile;

          @route("/query")
          op query is MosaicQueryApi.query;
        }
      }
    }
  }
}

model MosaicQueryApiNodeComponent
{
  name: string;
  type: string;
  value: unknown;
}

model MosaicQueryApiNodeResponse
{
  components: MosaicQueryApiNodeComponent[];
}

model MosaicQueryApiResponse
{
  nodes: MosaicQueryApiNodeResponse[];
}

interface MosaicQueryApi {
  @get op query(
    @path tesseraId: uuid,
    @path versionId: uuid,
    @query path: string;
    @query provenance: boolean;
    @query expandChildren: boolean;
    @query expandChildrenRecursive: boolean;
  ): MosaicQueryApiResponse;
}