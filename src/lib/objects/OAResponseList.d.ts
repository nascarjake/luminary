export type OAResponseList<T> = {
  object: 'list';
  data: T[];
  first_id: string;
  last_id: string;
  has_more: boolean;
}
