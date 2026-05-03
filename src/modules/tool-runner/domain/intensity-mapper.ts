import {
  type ExecutionIntensity,
  type SafeDetails,
  SchemaValidationError,
} from '../../../shared/contracts/foundation.js';
import { type ToolConfig, type ToolParameter, type ToolType } from '../contracts/tool-execution.contract.js';

export class IntensityMapper {
  readonly #configs: Map<ToolType, ToolConfig>;

  constructor(configs?: ToolConfig[]) {
    this.#configs = new Map();
    if (configs) {
      for (const config of configs) {
        this.#configs.set(config.toolType, config);
      }
    }
  }

  registerConfig(config: ToolConfig): void {
    this.#configs.set(config.toolType, config);
  }

  getConfig(toolType: ToolType): ToolConfig | undefined {
    return this.#configs.get(toolType);
  }

  mapParameters(
    toolType: ToolType,
    intensity: ExecutionIntensity,
    additionalParameters: Record<string, unknown> = {}
  ): ToolParameter[] {
    const config = this.#configs.get(toolType);
    if (!config) {
      throw new SchemaValidationError({
        tool_type: toolType,
        reason: 'tool_config_not_found',
      });
    }

    const intensityMapping = config.intensityMappings[intensity];
    if (!intensityMapping) {
      throw new SchemaValidationError({
        tool_type: toolType,
        intensity,
        reason: 'intensity_mapping_not_found',
      });
    }

    const allowedParameterNames = new Set(config.allowedParameters.map((parameter) => parameter.name));
    const unknownParameters = Object.entries(additionalParameters)
      .filter(([, value]) => value !== undefined)
      .map(([name]) => name)
      .filter((name) => !allowedParameterNames.has(name));

    if (unknownParameters.length > 0) {
      throw new SchemaValidationError({
        tool_type: toolType,
        reason: 'unsupported_parameter',
        unknown_parameters: unknownParameters,
      });
    }

    const parameters: ToolParameter[] = [];
    const details: SafeDetails = { tool_type: toolType, intensity };

    for (const allowedParam of config.allowedParameters) {
      let value: string | number | boolean | string[];
      let source: 'intensity_mapping' | 'static' | 'user_override' = 'intensity_mapping';

      const hasUserOverride = Object.prototype.hasOwnProperty.call(additionalParameters, allowedParam.name)
        && additionalParameters[allowedParam.name] !== undefined;

      if (hasUserOverride) {
        const userValue = additionalParameters[allowedParam.name];
        value = this.#validateAndConvertValue(userValue, allowedParam.valueType, allowedParam.name);
        source = 'user_override';
      } else if (allowedParam.name in intensityMapping) {
        const mappedValue = intensityMapping[allowedParam.name];
        value = this.#validateAndConvertValue(mappedValue, allowedParam.valueType, allowedParam.name);
      } else if (allowedParam.required) {
        throw new SchemaValidationError({
          ...details,
          parameter: allowedParam.name,
          reason: 'required_parameter_missing',
        });
      } else {
        continue;
      }

      parameters.push({
        name: allowedParam.name,
        value,
        source,
      });
    }

    return parameters;
  }

  #validateAndConvertValue(
    value: unknown,
    valueType: 'string' | 'number' | 'boolean' | 'string_array',
    paramName: string
  ): string | number | boolean | string[] {
    switch (valueType) {
      case 'string': {
        if (typeof value !== 'string') {
          throw new SchemaValidationError({
            parameter: paramName,
            expected_type: 'string',
            actual_type: typeof value,
          });
        }
        return value;
      }
      case 'number': {
        if (typeof value !== 'number' || Number.isNaN(value)) {
          throw new SchemaValidationError({
            parameter: paramName,
            expected_type: 'number',
            actual_type: typeof value,
          });
        }
        return value;
      }
      case 'boolean': {
        if (typeof value !== 'boolean') {
          throw new SchemaValidationError({
            parameter: paramName,
            expected_type: 'boolean',
            actual_type: typeof value,
          });
        }
        return value;
      }
      case 'string_array': {
        if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
          throw new SchemaValidationError({
            parameter: paramName,
            expected_type: 'string_array',
            actual_type: Array.isArray(value) ? 'array' : typeof value,
          });
        }
        return value as string[];
      }
      default: {
        throw new SchemaValidationError({
          parameter: paramName,
          unknown_value_type: valueType,
        });
      }
    }
  }
}
