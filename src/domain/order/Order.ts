import { DomainError, IsoDate, Result, err, ok } from "../shared";

export interface OrderDocument {
  readonly issuedAt: IsoDate;
}

/** 注文書（元請発行）／注文請書（協力会社発行）の発行状態。 */
export interface OrderState {
  readonly order: OrderDocument | null;
  readonly acknowledgement: OrderDocument | null;
}

export const initialOrderState: OrderState = { order: null, acknowledgement: null };

export function issueOrder(state: OrderState, at: IsoDate): Result<OrderState> {
  if (state.order) {
    return err(new DomainError("ORDER_ALREADY_ISSUED", "注文書は発行済みです"));
  }
  return ok({ ...state, order: { issuedAt: at } });
}

export function acknowledgeOrder(state: OrderState, at: IsoDate): Result<OrderState> {
  if (!state.order) {
    return err(new DomainError("ORDER_NOT_ISSUED", "注文書が発行されるまで注文請書は発行できません"));
  }
  if (state.acknowledgement) {
    return err(new DomainError("ORDER_ALREADY_ACKNOWLEDGED", "注文請書は発行済みです"));
  }
  return ok({ ...state, acknowledgement: { issuedAt: at } });
}
