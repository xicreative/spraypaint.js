export declare type IAddListener = (key: string, callback: Function) => void;
export declare type IRemoveListener = (key: string, callback: Function) => void;
export declare type IDispatch = (key: string, context: any, value: any) => void;
export interface IEventBus {
    addEventListener: IAddListener;
    removeEventListener: IRemoveListener;
    dispatch: IDispatch;
}
import * as EventBus from "eventbusjs";
declare module "eventbusjs" {
    interface EventBus extends IEventBus {
    }
}
export { EventBus };
