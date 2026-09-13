import { ipaths } from "../util/Paths";
import { term } from "../util/Terminal";

/**
 * Patch tstl to allow any kind of decorators (no longer needed?)
 */
export function applyTSTLHack() {
    term.debug('misc', `Applying TSTL hack`)
    let decoText = ipaths.node_modules.tstl_decorators.read('utf-8')
    let diagnosticsIndex = decoText.indexOf('context.diagnostics.push(');
    if(diagnosticsIndex==-1) {
        throw new Error(`Unable to find the "context.diagnostics" part`);
    }
    if(decoText[diagnosticsIndex-1]!='/') {
        decoText = decoText.substring(0,diagnosticsIndex)+'//'+decoText.substring(diagnosticsIndex,decoText.length);
        ipaths.node_modules.tstl_decorators.write(decoText);
    }

    // TSTL 1.6.2 treats function-valued class properties as methods even with
    // noImplicitSelf enabled. That changes `self.callback(args)` into a Lua
    // method call and inserts an extra self argument. Let callable properties
    // follow the normal noImplicitSelf rule while retaining method behavior.
    let contextText = ipaths.node_modules.tstl_function_context.read('utf-8')
    const propertyContext =
          '        ts.isConstructorDeclaration(signatureDeclaration) ||\n'
        + '        (signatureDeclaration.parent && ts.isPropertyDeclaration(signatureDeclaration.parent)) ||\n'
        + '        (signatureDeclaration.parent && ts.isPropertySignature(signatureDeclaration.parent))) {'
    const fixedContext = '        ts.isConstructorDeclaration(signatureDeclaration)) {'
    if(contextText.includes(propertyContext)) {
        contextText = contextText.replace(propertyContext,fixedContext)
        ipaths.node_modules.tstl_function_context.write(contextText)
    } else if(!contextText.includes(fixedContext)) {
        throw new Error(`Unable to find the TSTL callable-property context check`)
    }
}
