const PREC = {
  // this resolves a conflict between the usage of ':' in a lambda vs in a
  // typed parameter. In the case of a lambda, we don't allow typed parameters.
  lambda: -2,
  typed_parameter: -1,
  conditional: -1,

  parenthesized_expression: 1,
  parenthesized_list_splat: 1,
  not: 1,
  compare: 2,
  or: 10,
  and: 11,
  bitwise_or: 12,
  bitwise_and: 13,
  xor: 14,
  shift: 15,
  plus: 16,
  times: 17,
  unary: 18,
  power: 19,
  call: 20,
}

module.exports = grammar({
  name: 'python',

  extras: $ => [
    $.comment,
    /[\s\f\uFEFF\u2060\u200B]|\\\r?\n/
  ],

  conflicts: $ => [
    [$.primary_expression, $.pattern],
    [$.primary_expression, $.list_splat_pattern],
    [$.tuple, $.tuple_pattern],
    [$.list, $.list_pattern],
    [$.with_item, $._collection_elements],

    // [$.primary_expression, $.concatenated_string],
    // [$.concatenated_string],
    // primary_expression`, ``
    [$.typed_parameter, $.typed_default_parameter],
    [$.assignment_value_list], 
  ],

  supertypes: $ => [
    $._simple_statement,
    $._compound_statement,
    // $.expression,
    // $.primary_expression,
    // $.pattern,
  ],

  externals: $ => [
    $.newline,
    $.indent,
    $._dedent,
    $.string_start,
    $.string_content,
    $.string_end,
  ],

  inline: $ => [
    $._simple_statement,
    $._compound_statement,
    $._class_suite,
    $._suite,
    $._expressions,
    $._left_hand_side,
    $.keyword_identifier,
  ],

  word: $ => $.identifier,

  rules: {
    program: $ => optional_with_placeholder('statement_list', repeat($.statement)),

    statement: $ => choice(
      $.simple_statements,
      $._compound_statement
    ),

    // Modifiers
    async_modifier: $ => field('modifier', 'async'),

    // Simple statements

    simple_statements: $ => seq(
      $._simple_statement,
      optional(repeat(seq(
        $._semicolon,
        $._simple_statement
      ))),
      optional($._semicolon),
      $.newline
    ),

    _simple_statement: $ => choice(
      $.future_import_statement,
      $.import_statement,
      $.import_from_statement,
      $.print_statement,
      $.assert_statement,
      $.expression_statement,
      $.return,
      $.delete_statement,
      $.raise_statement,
      $.placeholder_statement,
      $.break_statement,
      $.continue_statement,
      $.global_statement,
      $.nonlocal_statement,
      $.exec_statement
    ),

    import_statement: $ => seq(
      'import',
      $._import_list
    ),

    import_prefix: $ => repeat1('.'),

    relative_import: $ => seq(
      $.import_prefix,
      optional($.dotted_name)
    ),

    future_import_statement: $ => seq(
      'from',
      '__future__',
      'import',
      choice(
        $._import_list,
        seq('(', $._import_list, ')'),
      )
    ),

    import_from_statement: $ => seq(
      'from',
      field('module_name', choice(
        $.relative_import,
        $.dotted_name
      )),
      'import',
      choice(
        $.wildcard_import,
        $._import_list,
        seq('(', $._import_list, ')')
      )
    ),

    _import_list: $ => seq(
      commaSep1(field('name', choice(
        $.dotted_name,
        $.aliased_import
      ))),
      optional(',')
    ),

    aliased_import: $ => seq(
      field('name', $.dotted_name),
      'as',
      field('alias', $.identifier)
    ),

    wildcard_import: $ => '*',

    print_statement: $ => choice(
      prec(1, seq(
        'print',
        $.chevron,
        repeat(seq(',', field('argument', $.expression))),
        optional(','))
      ),
      prec(-10, seq(
        'print',
        commaSep1(field('argument', $.expression)),
        optional(',')
      ))
    ),

    chevron: $ => seq(
      '>>',
      $.expression
    ),

    assert_statement: $ => seq(
      'assert',
      commaSep1($.expression)
    ),

    expression_statement: $ => choice(
      $.expression,
      seq(commaSep1($.expression), optional(',')),
      $.variable_declaration, 
      $.yield
    ),

    named_expression: $ => seq(
      field('name', $.identifier),
      ':=',
      field('value', $.expression)
    ),

    return_value: $ => $._expressions,

    return: $ => seq(
      'return',
      optional_with_placeholder('return_value_optional', $.return_value)
    ),

    delete_statement: $ => seq(
      'del',
      $._expressions
    ),

    _expressions: $ => choice(
      $.expression,
      $.expression_list
    ),

    raise_statement: $ => seq(
      'raise',
      optional($._expressions),
      optional(seq('from', field('cause', $.expression)))
    ),

    placeholder_statement: $ => prec.left('pass'),
    break_statement: $ => prec.left('break'),
    continue_statement: $ => prec.left('continue'),

    // Compound statements

    _compound_statement: $ => choice(
      $.if,
      $.for,
      $.while,
      $.try,
      $.with,
      $.function_definition,
      $.class_definition
    ),

    // if: $ => seq(
    //   $.if_clause,
    //   optional_with_placeholder('else_if_clause_list', repeat($.else_if_clause)),
    //   optional_with_placeholder('else_clause_optional', $.else_clause)
    // ),
    if: $ => seq(
      $.if_clause, 
      optional_with_placeholder('else_if_clause_list', 
        repeat($.else_if_clause)), 
      optional_with_placeholder('else_clause_optional', 
      $.else_clause)
    ),

    if_clause: $ => seq(
      'if',
      field('condition', $.expression),
      ':',
      $._suite,
      // repeat(field('alternative', $.else_if_clause)),
      // optional(field('alternative', $.else_clause))
    ),

    else_if_clause: $ => seq(
      'elif',
      field('condition', $.expression),
      ':',
      $._suite
    ),

    else_clause: $ => seq(
      'else',
      ':',
      $._suite
    ),

    for: $ => seq(
      $.for_each_clause,
      optional_with_placeholder('else_clause_optional', $.else_clause)
    ),

    for_each_clause: $ => seq(
      optional_with_placeholder('modifier_list', $.async_modifier),
      'for',
      field('block_iterator', $._left_hand_side),
      'in',
      field('block_collection', $._expressions),
      ':',
      $._suite
    ),

    while: $ => seq(
      $.while_clause, 
      optional_with_placeholder('else_clause_optional', 
      $.else_clause)
    ), 

    while_clause: $ => seq(
      'while',
      field('condition', $.expression),
      ':',
      $._suite,
    ),

    try: $ => seq(
      $.try_clause,
      choice(
        $.try_only_finally, 
        $.try_optional_finally
      )
    ),

    try_clause: $ => seq(
      'try',
      ':',
      $._suite,
    ),
    
    try_only_finally: $ => seq(
      optional_with_placeholder('catch_list', "!!UNMATCHABLE_7a83f927a297"),
      optional_with_placeholder('else_clause_optional', "!!UNMATCHABLE_d199ba40e22a"),
      field('finally_clause_optional', $.finally_clause)
    ), 

    try_optional_finally: $ => seq(
      field('catch_list', repeat1($.catch)),
      optional_with_placeholder('else_clause_optional', 
        $.else_clause),
      optional_with_placeholder('finally_clause_optional', $.finally_clause)
    ),

    catch_parameter: $ => seq(
      $.expression,
      optional(seq(
        choice('as', ','),
        $.expression
      ))
    ), 

    catch: $ => seq(
      'except',
      optional_with_placeholder('catch_parameter_optional', $.catch_parameter),
      ':',
      $._suite
    ),

    finally_clause: $ => seq(
      'finally',
      ':',
      $._suite
    ),

    with: $ => seq(
      optional_with_placeholder('modifier_list', $.async_modifier),
      'with',
      field('with_item_list', $.with_clause),
      ':',
      $._suite
    ),

    with_clause: $ => choice(
      commaSep1($.with_item),
      seq('(', commaSep1($.with_item), ')')
    ),

    with_item: $ => prec.dynamic(-1, seq(
      field('value', $.expression),
      optional_with_placeholder('with_item_alias_optional', 
      seq('as', alias($.pattern, $.with_item_alias)))
    )),

    function_definition: $ => seq(
      optional_with_placeholder('decorator_list', $.decorator_list),
      optional_with_placeholder('modifier_list', $.async_modifier),
      'def',
      field('name', $.identifier),
      field('parameters', $.parameters),
      optional_with_placeholder('return_type_optional', 
        seq(
          '->',
          $.type
        )
      ),
      ':',
      $._suite
    ),

    parameters: $ => seq(
      '(',
      optional_with_placeholder('parameter_list', $._parameters),
      ')'
    ),

    lambda_parameters: $ => $._parameters,

    list_splat: $ => field('splat', $.list_splat_inner),

    list_splat_inner: $ => seq(
      field('splat_operator', '*'),
      $.expression,
    ),

    dictionary_splat: $ => field('splat', $.dictionary_splat_inner),

    dictionary_splat_inner: $ => seq(
      field('splat_operator', '**'),
      $.expression
    ),

    global_statement: $ => seq(
      'global',
      commaSep1($.identifier)
    ),

    nonlocal_statement: $ => seq(
      'nonlocal',
      commaSep1($.identifier)
    ),

    exec_statement: $ => seq(
      'exec',
      field('code', $.string),
      optional(
        seq(
          'in',
          commaSep1($.expression)
        )
      )
    ),

    class_definition: $ => seq(
      optional_with_placeholder('decorator_list_optional', $.decorator_list),
      'class',
      field('name', $.identifier),
      optional_with_placeholder('extends_list_optional', seq(
      '(',
      optional($.extends_list),
      ')'
      )),
      ':',
      $._class_suite
    ),

    extends_list: $ => seq(
      commaSep1(
        field('extends_type', choice(
          $.expression,
          $.list_splat,
          $.dictionary_splat,
          alias($.parenthesized_list_splat, $.parenthesized_expression),
          $.keyword_argument
        ))
      ),
      optional(','),
    ),

    parenthesized_list_splat: $ => prec(PREC.parenthesized_list_splat, seq(
      '(',
      choice(
        alias($.parenthesized_list_splat, $.parenthesized_expression),
        $.list_splat,
      ),
      ')',
    )),

    argument: $ => choice(
      $.expression,
      $.list_splat,
      $.dictionary_splat,
      alias($.parenthesized_list_splat, $.parenthesized_expression),
      $.keyword_argument, 
      field('generator', seq(
        $.expression,
        $._comprehension_clauses
      )) // copied here to nest as argument
    ),

    argument_list_block: $ => seq(
      '(',
      optional_with_placeholder('argument_list', seq(
        optional(commaSep1($.argument)),
        optional(',')
      )),
      ')'
    ),

    // decorated_definition: $ => seq(
    //   field('decorator_list', repeat1($.decorator)),
    //   field('definition', choice(
    //     $.class_definition,
    //     $.function_definition
    //   ))
    // ),

    decorator_list: $ => repeat1($.decorator), 

    decorator: $ => seq(
      '@',
      field('decorator_expression', $.primary_expression),
      $.newline
    ),

    _suite: $ => choice(
      alias($.simple_statements, $.statement),
      seq($.indent, $.indentation_offset_body),
      seq(optional_with_placeholder('indentation_offset_body_placeholder', '!!NO_MATCH_afihw02h08'), $.newline)
    ),

    indentation_offset_body: $ => seq(
      optional_with_placeholder('statement_list', repeat($.statement)),
      $._dedent
    ),

    _class_suite: $ => choice(
      alias($.simple_statements, $.statement),
      seq($.indent, alias($.indentation_offset_body_class, $.indentation_offset_body)),
      $.newline
    ),

    indentation_offset_body_class: $ => seq(
      optional_with_placeholder('class_member_list', repeat(alias($.statement, $.member))),
      $._dedent
    ),

    expression_list: $ => prec.right(seq(
      $.expression,
      choice(
        ',',
        seq(
          repeat1(seq(
            ',',
            $.expression
          )),
          optional(',')
        ),
      )
    )),

    dotted_name: $ => field('identifier', sep1($.identifier, '.')),

    // Patterns

    _parameters: $ => seq(
      commaSep1($.parameter),
      optional(',')
    ),

    _patterns: $ => seq(
      commaSep1($.pattern),
      optional(',')
    ),

    parameter: $ => choice(
      $.plain_parameter, 
      // $.identifier,
      $.typed_parameter,
      // $.default_parameter,
      $.typed_default_parameter,
      // $.list_splat_pattern,
      // $.tuple_pattern,
      // alias('*', $.list_splat_pattern),
      // $.dictionary_splat_pattern
    ),

    pattern: $ => field('identifier', choice(
      $.identifier,
      $.keyword_identifier,
      $.subscript,
      $.attribute,
      $.list_splat_pattern,
      $.tuple_pattern,
      $.list_pattern
    )),

    tuple_pattern: $ => seq(
      '(',
      optional($._patterns),
      ')'
    ),

    list_pattern: $ => seq(
      '[',
      optional($._patterns),
      ']'
    ),

    parameter_value: $ => $.expression, 

    plain_parameter: $ => seq(
      field('identifier', choice(
        $.identifier, 
        $.list_splat_pattern, 
        $.dictionary_splat_pattern, 
        '*', 
        $.tuple_pattern
      )),
      optional_with_placeholder('type_optional', '!!NOMATCH_PLACEHOLDER_i23hg20h0'),
      optional_with_placeholder('parameter_value_optional', '!!NOMATCH_PLACEHOLDER_a309h23j')
    ),
    // default_parameter: $ => seq(
    //   field('name', $.identifier),
    //   field('parameter_value_optional', seq('=', $.parameter_value))
    // ),

    typed_default_parameter: $ => prec(PREC.typed_parameter, seq(
      field('name', $.identifier),
      optional_with_placeholder('type_optional', seq(
        ':',
        $.type)),
      field('parameter_value_optional', seq('=', $.parameter_value))
    )),

    list_splat_pattern: $ => seq(
      '*',
      choice($.identifier, $.keyword_identifier, $.subscript, $.attribute)
    ),

    dictionary_splat_pattern: $ => seq(
      '**',
      choice($.identifier, $.keyword_identifier, $.subscript, $.attribute)
    ),

    // Expressions

    _expression_within_for_in_clause: $ => choice(
      $.expression,
      alias($.lambda_within_for_in_clause, $.lambda)
    ),

    expression: $ => choice(
      $.comparison_operator,
      $.not_operator,
      $.boolean_operator,
      $.await,
      $.lambda,
      $.primary_expression,
      $.conditional_expression,
      $.named_expression
    ),

    primary_expression: $ => choice(
      $.binary_operator,
      $.identifier,
      $.keyword_identifier,
      $.string,
      $.concatenated_string,
      $.integer,
      $.float,
      $.true,
      $.false,
      $.none,
      $.unary_operator,
      $.attribute,
      $.subscript,
      $.call,
      $.list,
      $.list_comprehension,
      $.dictionary,
      $.dictionary_comprehension,
      $.set,
      $.set_comprehension,
      $.tuple,
      $.parenthesized_expression,
      $.generator,
      $.ellipsis
    ),

    not_operator: $ => prec(PREC.not, seq(
      'not',
      field('argument', $.expression)
    )),

    boolean_operator: $ => choice(
      prec.left(PREC.and, seq(
        field('left', $.expression),
        field('operator', 'and'),
        field('right', $.expression)
      )),
      prec.left(PREC.or, seq(
        field('left', $.expression),
        field('operator', 'or'),
        field('right', $.expression)
      ))
    ),

    binary_operator: $ => {
      const table = [
        [prec.left, '+', PREC.plus],
        [prec.left, '-', PREC.plus],
        [prec.left, '*', PREC.times],
        [prec.left, '@', PREC.times],
        [prec.left, '/', PREC.times],
        [prec.left, '%', PREC.times],
        [prec.left, '//', PREC.times],
        [prec.right, '**', PREC.power],
        [prec.left, '|', PREC.bitwise_or],
        [prec.left, '&', PREC.bitwise_and],
        [prec.left, '^', PREC.xor],
        [prec.left, '<<', PREC.shift],
        [prec.left, '>>', PREC.shift],
      ];

      return choice(...table.map(([fn, operator, precedence]) => fn(precedence, seq(
        field('left', $.primary_expression),
        field('operator', operator),
        field('right', $.primary_expression)
      ))));
    },

    unary_operator: $ => prec(PREC.unary, seq(
      field('operator', choice('+', '-', '~')),
      field('argument', $.primary_expression)
    )),

    comparison_operator: $ => prec.left(PREC.compare, seq(
      $.primary_expression,
      repeat1(seq(
        field('operators',
          choice(
            '<',
            '<=',
            '==',
            '!=',
            '>=',
            '>',
            '<>',
            'in',
            seq('not', 'in'),
            'is',
            seq('is', 'not')
          )),
          $.primary_expression
        ))
    )),

    lambda: $ => prec(PREC.lambda, seq(
      'lambda',
      optional_with_placeholder('parameter_list', $.lambda_parameters),
      ':',
      field('return_value', $.expression)
    )),

    lambda_within_for_in_clause: $ => seq(
      'lambda',
      optional_with_placeholder('parameter_list', $.lambda_parameters),
      ':',
      field('return_value', $._expression_within_for_in_clause)
    ),

    variable_declaration: $ => field(
      'assignment_list', 
      choice($.assignment, $.augmented_assignment)
    ),

    assignment: $ => seq(
      $.assignment_variable_list,
      optional_with_placeholder('type_optional', 
        seq(':', $.type)
      ),
      '=', 
      $.assignment_value_list
    ),

    augmented_assignment: $ => seq(
      $.assignment_variable_list,
      field('operator', choice(
        '+=', '-=', '*=', '/=', '@=', '//=', '%=', '**=',
        '>>=', '<<=', '&=', '^=', '|='
      )),
      $.assignment_value_list
    ),

    assignment_variable_list: $ => seq(
      commaSep1(alias($.pattern, $.assignment_variable)), 
      optional(',')
    ),

    assignment_value_list: $ => seq(
      commaSep1($.assignment_value), 
      optional(',')
    ),
    
    assignment_value: $ => choice(
      $.expression, 
      $.variable_declaration, 
      $.yield
    ), 

    _left_hand_side: $ => choice(
      $.pattern,
      $.pattern_list
    ),

    pattern_list: $ => seq(
      $.pattern,
      choice(
        ',',
        seq(
          repeat1(seq(
            ',',
            $.pattern
          )),
          optional(',')
        )
      )
    ),

    // _right_hand_side: $ => choice(
    //   $.expression,
    //   $.expression_list,
    //   $.variable_declaration, 
    //   $.yield
    // ),

    yield: $ => prec.right(seq(
      'yield',
      choice(
        seq(
          'from',
          $.expression
        ),
        optional($._expressions)
      )
    )),

    attribute: $ => prec(PREC.call, seq(
      field('object', $.primary_expression),
      '.',
      field('attribute', $.identifier)
    )),

    subscript: $ => prec(PREC.call, seq(
      field('value', $.primary_expression),
      '[',
      commaSep1(field('subscript', choice($.expression, $.slice))),
      optional(','),
      ']'
    )),

    slice: $ => seq(
      optional($.expression),
      ':',
      optional($.expression),
      optional(seq(':', optional($.expression)))
    ),

    ellipsis: $ => '...',

    call: $ => prec(PREC.call, seq(
      field('function_', $.primary_expression),
      $.argument_list_block
    )),

    typed_parameter: $ => prec(PREC.typed_parameter, seq(
      field('identifier', choice(
        $.identifier,
        $.list_splat_pattern,
        $.dictionary_splat_pattern
      )),
      field('type_optional', seq(
        ':',
        $.type
      )), 
      optional_with_placeholder('parameter_value_optional', '!!UNMATCHED_OPTIONAL')
    )),

    type: $ => $.expression,

    keyword_argument: $ => seq(
      field('name', choice($.identifier, $.keyword_identifier)),
      '=',
      field('value', $.expression)
    ),

    // Literals

    list: $ => seq(
      '[',
      optional($._collection_elements),
      ']'
    ),

    set: $ => seq(
      '{',
      $._collection_elements,
      '}'
    ),

    tuple: $ => seq(
      '(',
      optional($._collection_elements),
      ')'
    ),

    dictionary: $ => seq(
      '{',
      optional_with_placeholder('key_value_pair_list', seq(
        optional(commaSep1(choice($.key_value_pair, $.dictionary_splat))),
        optional(','),
      )),
      '}'
    ),

    key_value_pair: $ => seq(
      field('key_value_pair_key', $.expression),
      ':',
      field('key_value_pair_value', $.expression)
    ),

    list_comprehension: $ => seq(
      '[',
      field('body', $.expression),
      $._comprehension_clauses,
      ']'
    ),

    dictionary_comprehension: $ => seq(
      '{',
      field('body', $.key_value_pair),
      $._comprehension_clauses,
      '}'
    ),

    set_comprehension: $ => seq(
      '{',
      field('body', $.expression),
      $._comprehension_clauses,
      '}'
    ),

    generator: $ => seq(
      '(',
      seq(
        $.expression,
        $._comprehension_clauses
      ),
      ')'
    ),

    _comprehension_clauses: $ => seq(
      $.for_in_clause,
      repeat(choice(
        $.for_in_clause,
        $.if_clause_comprehension
      ))
    ),

    parenthesized_expression: $ => prec(PREC.parenthesized_expression, seq(
      '(',
      choice($.expression, $.yield),
      ')'
    )),

    _collection_elements: $ => seq(
      commaSep1(field('list_element', choice(
        $.expression, $.yield, $.list_splat, $.parenthesized_list_splat
      ))),
      optional(',')
    ),

    for_in_clause: $ => prec.left(seq(
      optional_with_placeholder('modifier_list', $.async_modifier),
      'for',
      field('left', $._left_hand_side),
      'in',
      field('right', commaSep1($._expression_within_for_in_clause)),
      optional(',')
    )),

    if_clause_comprehension: $ => seq(
      'if',
      $.expression
    ),

    conditional_expression: $ => prec.right(PREC.conditional, seq(
      $.expression,
      'if',
      $.expression,
      'else',
      $.expression
    )),

    concatenated_string: $ => seq(
      $.string,
      repeat1($.string)
    ),

    string: $ => seq(
      $.string_start,
      optional_with_placeholder('string_text', 
        repeat(choice($.interpolation, $.escape_sequence, $._not_escape_sequence, $.string_content))
      ),
      $.string_end
    ),

    interpolation: $ => seq(
      '{',
      $.expression,
      optional($.type_conversion),
      optional($.format_specifier),
      '}'
    ),

    escape_sequence: $ => token(prec(1, seq(
      '\\',
      choice(
        /u[a-fA-F\d]{4}/,
        /U[a-fA-F\d]{8}/,
        /x[a-fA-F\d]{2}/,
        /\d{3}/,
        /\r?\n/,
        /['"abfrntv\\]/,
      )
    ))),

    _not_escape_sequence: $ => '\\',

    format_specifier: $ => seq(
      ':',
      repeat(choice(
        token(prec(1, /[^{}\n]+/)),
        $.format_expression
      ))
    ),

    format_expression: $ => seq('{', $.expression, '}'),

    type_conversion: $ => /![a-z]/,

    integer: $ => token(choice(
      seq(
        choice('0x', '0X'),
        repeat1(/_?[A-Fa-f0-9]+/),
        optional(/[Ll]/)
      ),
      seq(
        choice('0o', '0O'),
        repeat1(/_?[0-7]+/),
        optional(/[Ll]/)
      ),
      seq(
        choice('0b', '0B'),
        repeat1(/_?[0-1]+/),
        optional(/[Ll]/)
      ),
      seq(
        repeat1(/[0-9]+_?/),
        choice(
          optional(/[Ll]/), // long numbers
          optional(/[jJ]/) // complex numbers
        )
      )
    )),

    float: $ => {
      const digits = repeat1(/[0-9]+_?/);
      const exponent = seq(/[eE][\+-]?/, digits)

      return token(seq(
        choice(
          seq(digits, '.', optional(digits), optional(exponent)),
          seq(optional(digits), '.', digits, optional(exponent)),
          seq(digits, exponent)
        ),
        optional(choice(/[Ll]/, /[jJ]/))
      ))
    },

    identifier: $ => /[_\p{XID_Start}][_\p{XID_Continue}]*/,

    keywords: $ => choice(
      'print',
      'exec',
      'async',
      'await',
    ),
    
    keyword_identifier: $ => prec(-3, alias(
      $.keywords,
      $.identifier
    )),

    true: $ => 'True',
    false: $ => 'False',
    none: $ => 'None',

    await: $ => prec(PREC.unary, seq(
      'await',
      $.expression
    )),

    comment: $ => token(seq('#', /.*/)),

    _semicolon: $ => ';'
  }
})

function commaSep1 (rule) {
  return sep1(rule, ',')
}

function sep1 (rule, separator) {
  return seq(rule, repeat(seq(separator, rule)))
}

function optional_with_placeholder(field_name, rule) {
  return choice(field(field_name, rule), field(field_name, blank()))
}
