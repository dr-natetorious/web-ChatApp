"""
Policy models for service access control

Simple access control models - if a resource is listed, it's allowed.
"""
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


class DatabricksPolicy(BaseModel):
    """Policy configuration for Databricks service access"""
    token: str = Field(..., description="Authentication token")
    enabled: bool = Field(True, description="Whether Databricks access is enabled")
    workspace_url: Optional[str] = Field(None, description="Databricks workspace URL")
    spaces: List[str] = Field(
        default_factory=list,
        description="List of accessible Genie space IDs (must be explicitly listed)"
    )
    
    @field_validator('token')
    @classmethod
    def validate_token(cls, v):
        """Basic token format validation"""
        return v.strip() if v else ""
    
    @model_validator(mode='after')
    def validate_token_when_enabled(self):
        """Validate token is provided when service is enabled"""
        if self.enabled and not self.token:
            raise ValueError("Token cannot be empty when service is enabled")
        return self
    
    def is_space_allowed(self, space_id: str) -> bool:
        """Check if space access is allowed"""
        return space_id in self.spaces


class SnowflakePolicy(BaseModel):
    """Policy configuration for Snowflake service access"""
    token: str = Field(..., description="Authentication token")
    account: str = Field(..., description="Snowflake account identifier")
    user: str = Field(..., description="Snowflake username")
    enabled: bool = Field(True, description="Whether Snowflake access is enabled")
    clusters: List[str] = Field(
        default_factory=list,
        description="List of accessible cluster/warehouse IDs (must be explicitly listed)"
    )
    databases: List[str] = Field(
        default_factory=list,
        description="List of accessible databases (must be explicitly listed)"
    )
    
    @field_validator('token')
    @classmethod
    def validate_token(cls, v):
        """Basic token format validation"""
        return v.strip() if v else ""
    
    @model_validator(mode='after')
    def validate_token_when_enabled(self):
        """Validate token is provided when service is enabled"""
        if self.enabled and not self.token:
            raise ValueError("Token cannot be empty when service is enabled")
        return self
    
    def is_cluster_allowed(self, cluster_id: str) -> bool:
        """Check if cluster access is allowed"""
        return cluster_id in self.clusters
    
    def is_database_allowed(self, database: str) -> bool:
        """Check if database access is allowed"""
        return database in self.databases


class OperationToolingPolicy(BaseModel):
    """
    Access control policy for cloud AI services.
    Simple model: if service is configured and enabled, it's allowed.
    """
    databricks: Optional[DatabricksPolicy] = Field(None, description="Databricks access configuration")
    snowflake: Optional[SnowflakePolicy] = Field(None, description="Snowflake access configuration")

    def get_enabled_services(self) -> List[str]:
        """Get list of enabled services."""
        services = []
        if self.databricks and self.databricks.enabled:
            services.append("databricks")
        if self.snowflake and self.snowflake.enabled:
            services.append("snowflake")
        return services

    def is_service_enabled(self, service: str) -> bool:
        """Check if a service is enabled."""
        if service == "databricks":
            return self.databricks is not None and self.databricks.enabled
        elif service == "snowflake":
            return self.snowflake is not None and self.snowflake.enabled
        return False

    def validate_operation(self, service: str, operation: str, **kwargs) -> bool:
        """Validate if an operation is allowed."""
        return self.is_service_enabled(service)

    def get_service_token(self, service: str) -> Optional[str]:
        """Get authentication token for a service."""
        if service == "databricks" and self.databricks:
            return self.databricks.token
        elif service == "snowflake" and self.snowflake:
            return self.snowflake.token
        return None


class UnauthorizedOperationError(Exception):
    """Raised when an operation is not allowed by the current policy."""
    
    def __init__(self, service: str, operation: str, details: str = ""):
        self.service = service
        self.operation = operation
        self.details = details
        super().__init__(f"Unauthorized operation: {service}.{operation} - {details}")


class PolicyValidationError(Exception):
    """Exception raised when policy validation fails"""
    pass