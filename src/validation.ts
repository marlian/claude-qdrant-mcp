import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { Entity, Relation } from "./types.js";

export interface CreateEntitiesRequest {
  entities: Entity[];
}

export interface CreateRelationsRequest {
  relations: Relation[];
}

export interface AddObservationsRequest {
  observations: Array<{
    entityName: string;
    contents: string[];
  }>;
}

export interface DeleteEntitiesRequest {
  entityNames: string[];
}

export interface DeleteObservationsRequest {
  deletions: Array<{
    entityName: string;
    observations: string[];
  }>;
}

export interface DeleteRelationsRequest {
  relations: Relation[];
}

export interface SearchSimilarRequest {
  query: string;
  limit?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function isEntity(value: unknown): value is Entity {
  if (!isRecord(value)) return false;
  return (
    typeof value.name === 'string' &&
    typeof value.entityType === 'string' &&
    Array.isArray(value.observations) &&
    value.observations.every(obs => typeof obs === 'string')
  );
}

function isRelation(value: unknown): value is Relation {
  if (!isRecord(value)) return false;
  return (
    typeof value.from === 'string' &&
    typeof value.to === 'string' &&
    typeof value.relationType === 'string'
  );
}

export function validateCreateEntitiesRequest(args: unknown): CreateEntitiesRequest {
  if (!isRecord(args)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid request format");
  }

  const { entities } = args;
  if (!Array.isArray(entities) || !entities.every(isEntity)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid entities array");
  }

  return { entities };
}

export function validateCreateRelationsRequest(args: unknown): CreateRelationsRequest {
  if (!isRecord(args)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid request format");
  }

  const { relations } = args;
  if (!Array.isArray(relations) || !relations.every(isRelation)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid relations array");
  }

  return { relations };
}

export function validateAddObservationsRequest(args: unknown): AddObservationsRequest {
  if (!isRecord(args)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid request format");
  }

  const { observations } = args;
  if (!Array.isArray(observations)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid observations array");
  }

  for (const obs of observations) {
    if (!isRecord(obs) || typeof obs.entityName !== 'string' || !isStringArray(obs.contents)) {
      throw new McpError(ErrorCode.InvalidParams, "Invalid observation format");
    }
  }

  return { observations: observations as AddObservationsRequest['observations'] };
}

export function validateDeleteEntitiesRequest(args: unknown): DeleteEntitiesRequest {
  if (!isRecord(args)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid request format");
  }

  const { entityNames } = args;
  if (!isStringArray(entityNames)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid entityNames array");
  }

  return { entityNames };
}

export function validateDeleteObservationsRequest(args: unknown): DeleteObservationsRequest {
  if (!isRecord(args)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid request format");
  }

  const { deletions } = args;
  if (!Array.isArray(deletions)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid deletions array");
  }

  for (const del of deletions) {
    if (!isRecord(del) || typeof del.entityName !== 'string' || !isStringArray(del.observations)) {
      throw new McpError(ErrorCode.InvalidParams, "Invalid deletion format");
    }
  }

  return { deletions: deletions as DeleteObservationsRequest['deletions'] };
}

export function validateDeleteRelationsRequest(args: unknown): DeleteRelationsRequest {
  if (!isRecord(args)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid request format");
  }

  const { relations } = args;
  if (!Array.isArray(relations) || !relations.every(isRelation)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid relations array");
  }

  return { relations };
}

export function validateSearchSimilarRequest(args: unknown): SearchSimilarRequest {
  if (!isRecord(args)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid request format");
  }

  const { query, limit } = args;
  if (typeof query !== 'string') {
    throw new McpError(ErrorCode.InvalidParams, "Missing or invalid query string");
  }

  if (limit !== undefined && (typeof limit !== 'number' || limit <= 0)) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid limit value");
  }

  return { query, limit };
}