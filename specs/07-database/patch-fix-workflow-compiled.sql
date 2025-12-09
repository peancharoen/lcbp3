-- Patch: Fix CORRESPONDENCE_FLOW_V1 compiled data
-- The compiled JSON used 'target' but code expects 'to'
-- Run this to update existing workflow_definitions
UPDATE workflow_definitions
SET compiled = JSON_OBJECT(
    'workflow',
    'CORRESPONDENCE_FLOW_V1',
    'version',
    1,
    'initialState',
    'DRAFT',
    'states',
    JSON_OBJECT(
      'DRAFT',
      JSON_OBJECT(
        'terminal',
        false,
        'transitions',
        JSON_OBJECT(
          'SUBMIT',
          JSON_OBJECT(
            'to',
            'IN_REVIEW',
            'requirements',
            JSON_OBJECT('roles', JSON_ARRAY()),
            'events',
            JSON_ARRAY()
          )
        )
      ),
      'IN_REVIEW',
      JSON_OBJECT(
        'terminal',
        false,
        'transitions',
        JSON_OBJECT(
          'APPROVE',
          JSON_OBJECT(
            'to',
            'APPROVED',
            'requirements',
            JSON_OBJECT('roles', JSON_ARRAY()),
            'events',
            JSON_ARRAY()
          ),
          'REJECT',
          JSON_OBJECT(
            'to',
            'REJECTED',
            'requirements',
            JSON_OBJECT('roles', JSON_ARRAY()),
            'events',
            JSON_ARRAY()
          ),
          'RETURN',
          JSON_OBJECT(
            'to',
            'DRAFT',
            'requirements',
            JSON_OBJECT('roles', JSON_ARRAY()),
            'events',
            JSON_ARRAY()
          )
        )
      ),
      'APPROVED',
      JSON_OBJECT(
        'terminal',
        TRUE,
        'transitions',
        JSON_OBJECT()
      ),
      'REJECTED',
      JSON_OBJECT(
        'terminal',
        TRUE,
        'transitions',
        JSON_OBJECT()
      )
    )
  )
WHERE workflow_code = 'CORRESPONDENCE_FLOW_V1';
