import { IsoDate } from "./date";

/**
 * Only aggregate roots (Transaction, Project) raise domain events. Sub-entities such as
 * WorkTrack/BillingTrack/Order return plain state + Result — the aggregate root decides
 * when a state change is significant enough to become an event and stamps it with
 * transaction/company identity. This keeps event identity centralized, per DDD.
 */
export interface DomainEvent<Name extends string = string, Payload = unknown> {
  readonly name: Name;
  readonly occurredAt: IsoDate;
  readonly payload: Payload;
}

export function createEvent<Name extends string, Payload>(
  name: Name,
  occurredAt: IsoDate,
  payload: Payload,
): DomainEvent<Name, Payload> {
  return { name, occurredAt, payload };
}
