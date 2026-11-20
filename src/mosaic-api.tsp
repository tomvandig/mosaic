
import "@typespec/openapi3";
import "@typespec/openapi";
import "@typespec/http";

using Http;
using OpenAPI;

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

enum NodeFetchFormat
{
  glb,
  tsr
}

model NodeFetchRequest
{
  nodes: uuid[];              // the nodes to fetch, by id
  componentTypes?: string[];  // only these component types; all of them when left out
  includeChildren?: boolean;  // take everything beneath them as well
  compose?: boolean;          // resolve inheritance, as composing does, before answering
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
@route("/mosaic-api")
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
      
      @route("/upload-mosaic-blob-url")
      @post op uploadMosaicBlobUrl(@path tesseraId: uuid): BlobResponse;

      @route("/versions")
      namespace VersionsRoutes {
        @post op createTesseraVersion(@path tesseraId: uuid, @body version: CreateTesseraVersionCommand): CreateTesseraVersionResponse;

        @route("/{versionId}")
        namespace TesseraVersionRoutes
        {
          @get op get_tessera_version(@path tesseraId: uuid, @path versionId: uuid): TesseraVersion;

          @route("/download-mosaic")
          @put op tessera_Mosaic(
            @path tesseraId: uuid, 
            @path versionId: uuid,
            @query downloadType: MosaicFileDownloadType
          ): TesseraVersionMosaicFile;

          @route("/nodes")
          @post op fetchNodes(
            @path tesseraId: uuid,
            @path versionId: uuid,
            @query format: NodeFetchFormat,
            @body request: NodeFetchRequest
          ): File;

          // A SPARQL 1.1 Protocol query service over this version: one URL, the query sent
          // either way the protocol allows, the results negotiated through Accept.
          // https://www.w3.org/TR/sparql11-protocol/#query-operation
          @route("/sparql")
          @get op sparqlQuery(
            @path tesseraId: uuid,
            @path versionId: uuid,
            ...SparqlQueryParameters,
            @query query: string,
          ): SparqlQueryResult | SparqlQueryError;

          @route("/sparql")
          @post op sparqlQueryPost(
            @path tesseraId: uuid,
            @path versionId: uuid,
            ...SparqlQueryParameters,
            @header contentType: "application/sparql-query",
            @body query: string,
          ): SparqlQueryResult | SparqlQueryError;

          // The part of the version a path names, addressed by the URL alone, so a client that
          // builds URLs from a template -- a 3D Tiles content template, say -- can reach it.
          // The extension on the path says which format to answer in.
          @route("/node/{+path}")
          @get op nodeAtPath(
            @path tesseraId: uuid,
            @path versionId: uuid,
            ...NodePathParameter,
          ): NodeAsGltf | NodeAsGlb | NodePathFormatUnknown | NodePathNotFound;

          @route("/types")
          @get op get_types(@path tesseraId: uuid, @path versionId: uuid): unknown[];
        }
      }
    }
  }
}

// --- nodes by path ---------------------------------------------------------

/**
 * The extensions a node path can end in, each the format it answers with. More can be added;
 * one the server does not know is answered with NodePathFormatUnknown.
 */
enum NodePathFormat
{
  gltf,  // model/gltf+json
  glb,   // model/gltf-binary
}

model NodePathParameter
{
  /**
   * One or more segments separated by "/", each naming a node beneath the one before, from a
   * root of the version, and ending in the format to answer in: "root/parent/child.glb".
   * A segment matches a node by id or by name. The extension is not part of the last name,
   * and is required: it is a NodePathFormat.
   */
  // Reserved expansion, {+path} in the route, so the "/" between segments is sent as it is.
  // OpenAPI 3 cannot say that of a path parameter, so the extension says it for the
  // generated client and server, and for anyone else reading the OpenAPI.
  #suppress "@typespec/openapi3/path-reserved-expansion" "Carried by x-mosaic-reserved-expansion instead"
  @extension("x-mosaic-reserved-expansion", true)
  @path path: string;
}

/** The node the path names and everything beneath it, as a glTF document (".gltf"). */
model NodeAsGltf
{
  @header contentType: "model/gltf+json";
  @body gltf: bytes;
}

/** The node the path names and everything beneath it, as a binary glTF (".glb"). */
model NodeAsGlb
{
  @header contentType: "model/gltf-binary";
  @body glb: bytes;
}

/** The path has no extension, or one that is not a NodePathFormat this server answers in. */
@error
model NodePathFormatUnknown
{
  @statusCode _: 400;
  error: string;
  /** The extensions this server does answer in. */
  supported: NodePathFormat[];
}

/** No node in the version answers to the path. */
@error
model NodePathNotFound
{
  @statusCode _: 404;
  error: string;
}

// --- SPARQL 1.1 Protocol ---------------------------------------------------

/** What both ways of sending a query share: the dataset it runs against, and the results asked for. */
model SparqlQueryParameters
{
  /** The graphs that make up the default graph. Overrides FROM in the query. */
  @query(#{ explode: true }) `default-graph-uri`?: string[];
  /** The named graphs the query can see. Overrides FROM NAMED in the query. */
  @query(#{ explode: true }) `named-graph-uri`?: string[];
  /** Which result format to answer with, as media types with optional q-values. */
  @header accept?: string;
}

/**
 * SELECT and ASK answer with SPARQL results, CONSTRUCT and DESCRIBE with RDF.
 * Which of these a reply is in follows from the query and the Accept header.
 */
alias SparqlResultMediaType =
  | "application/sparql-results+json"
  | "application/sparql-results+xml"
  | "text/csv"
  | "text/tab-separated-values"
  | "text/turtle"
  | "application/n-triples"
  | "application/ld+json"
  | "application/rdf+xml";

model SparqlQueryResult
{
  @header contentType: SparqlResultMediaType;
  @body results: bytes;
}

/** The query could not be parsed, or the request was not a valid protocol request. */
@error
model SparqlQueryError
{
  @statusCode _: 400;
  error: string;
}