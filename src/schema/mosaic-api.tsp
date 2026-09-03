
import "@typespec/openapi3";
import "@typespec/http";

using Http;

@pattern("</(\\{{0,1}([0-9a-fA-F]){8}-([0-9a-fA-F]){4}-([0-9a-fA-F]){4}-([0-9a-fA-F]){4}-([0-9a-fA-F]){12}\\}{0,1})[0-9a-zA-Z\\/]+>")
scalar path extends string;

@pattern("</[A-Za-z0-9.]+:[A-Za-z0-9]+>")
scalar attribute_uri extends string;

@pattern("</[A-Za-z0-9.]+")
scalar attribute_file_name extends string;

@format("uuid")
scalar uuid extends string;

model ModelStatus
{
  id: uuid;
  name: string;
  latestVersion: uuid;
}

model ModelDetails
{
  id: uuid;
  name: string;
  history: ModelVersion[]
}

model MosaicProvenanceData
{
  author: string;
  timestamp: string;
  application: string;
  message: string;
}

model ModelVersion
{
  modelId: uuid;
  versionId: uuid;
  previousVersionId: uuid;
  provenance: MosaicProvenanceData;
}

model ModelVersionMosaicFile
{
  blobUrl: string;
}

model CreateModelCommand
{
  id: uuid;
  name: string;
   ...Record<never>; // make additionalProperties = false show up
}

model UpdateModelCommand
{
  name: string;
}

model CreateModelVersionCommand
{
  id: uuid;
  previousModelVersionId: uuid;
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
  whole_model_history_intact,
  whole_model_history_condensed,
  whole_model_and_imports_history_condensed
}

enum CreateModelVersionResponseState
{
  OK,
  OUT_OF_DATE,
  VALIDATION_ERROR
}

model CreateModelVersionResponse
{
  state: CreateModelVersionResponseState;
  validationErrors: string[];
}

@service
@route("/Mosaic-api")
namespace MosaicApi {
    
  @route("/upload/{blobId}")
  @put op upload(@path blobId: uuid, @bodyRoot file: File): OkResponse;
  
  @route("/download/{blobId}")
  @put op download(@path blobId: uuid): File;
  
  @route("/models")
  namespace Models
  {
    @get op models(): ModelStatus[];

    @post op createModel(@body cmd: CreateModelCommand): OkResponse;

    @route("/{modelId}")
    namespace ModelRoutes {
      @get op get_model(@path modelId: uuid): ModelDetails;
      @delete op delete_model(@path modelId: uuid): OkResponse;
      
      @route("/upload-Mosaic-blob-url")
      @post op uploadMosaicBlobUrl(@path modelId: uuid): BlobResponse;

      @route("/versions")
      namespace VersionsRoutes {
        @post op createModelVersion(@path modelId: uuid, @body version: CreateModelVersionCommand): CreateModelVersionResponse;

        @route("/{versionId}")
        namespace ModelVersionRoutes
        {
          @get op get_model_version(@path modelId: uuid, @path versionId: uuid): ModelVersion;

          @route("/download-Mosaic")
          @put op model_Mosaic(
            @path modelId: uuid, 
            @path versionId: uuid,
            @query downloadType: MosaicFileDownloadType
          ): ModelVersionMosaicFile;

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
    @path modelId: uuid,
    @path versionId: uuid,
    @query path: string;
    @query provenance: boolean;
    @query expandChildren: boolean;
    @query expandChildrenRecursive: boolean;
  ): MosaicQueryApiResponse;
}